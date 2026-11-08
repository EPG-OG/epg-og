// Checks freshly built listings before they're published, so a broken or half-empty feed can't
// wipe channels (and people's favourites) off the guide. For each country it compares the new file
// with the one live on the website. If the new one looks wrong, the live file is published again
// instead, and the problem is reported so the workflow can email it.
//
// Usage: node scripts/check-listings.mjs <built dir> <live site URL>
// Set FORCE=true to publish the new files anyway, such as after deliberately removing channels.
// Writes `problem=<summary>` to $GITHUB_OUTPUT when anything was held back or looks wrong.

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { regions as lineup } from './lineup.mjs';

const [dir, base] = process.argv.slice(2);
const force = process.env.FORCE === 'true';
const REGIONS = ['us', 'uk'];
// A new build must keep at least this share of the live channels...
const MIN_CHANNEL_SHARE = 0.85;
// ...and its typical channel must have listings at least this far ahead of when it was built.
const MIN_HOURS_AHEAD = 24;
// The live copy is only worth keeping if it still covers this far ahead of now.
const MIN_LIVE_HOURS_LEFT = 6;

const channelsOf = (guide) => guide.categories.flatMap((c) => c.channels);

/** Hours ahead of `from` that the typical (median) channel's listings run. */
function hoursAhead(guide, from) {
  const ends = channelsOf(guide).map((c) => c.programmes.at(-1)?.e ?? 0).sort((a, b) => a - b);
  return ends.length ? (ends[Math.floor(ends.length / 2)] - from) / 3600 : 0;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return undefined;
  }
}

async function fetchLive(region) {
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/${region}.json`, { cache: 'no-store' });
    return res.ok ? { text: await res.text() } : undefined;
  } catch {
    return undefined;
  }
}

// The build may have failed before creating its folder.
await mkdir(dir, { recursive: true });

const problems = [];
for (const region of REGIONS) {
  const file = path.join(dir, `${region}.json`);
  const fresh = await readJson(file);
  const liveRaw = await fetchLive(region);
  let live;
  try {
    live = liveRaw && JSON.parse(liveRaw.text);
  } catch {
    live = undefined;
  }

  const issues = [];
  if (!fresh?.categories) issues.push('the new listings are missing or unreadable');
  else {
    const n = channelsOf(fresh).length;
    // Compared with the live site, or with the lineup if the site can't be reached.
    const liveN = live?.categories ? channelsOf(live).length : 0;
    const expected = liveN || lineup[region].categories.reduce((sum, c) => sum + c.channels.length, 0);
    if (n < expected * MIN_CHANNEL_SHARE) issues.push(`only ${n} channels, down from ${expected}`);
    const ahead = hoursAhead(fresh, fresh.generatedAt);
    if (ahead < MIN_HOURS_AHEAD) issues.push(`listings only run ${ahead.toFixed(0)} hours ahead`);
  }
  const label = region.toUpperCase();
  if (!issues.length) {
    console.log(`${label}: ok, ${channelsOf(fresh).length} channels, ${hoursAhead(fresh, fresh.generatedAt).toFixed(0)} hours ahead`);
    continue;
  }

  const liveUsable = live?.categories && hoursAhead(live, Date.now() / 1000) >= MIN_LIVE_HOURS_LEFT;
  let outcome;
  if (force && fresh?.categories) outcome = 'published anyway (forced)';
  else if (liveUsable) {
    await writeFile(file, liveRaw.text);
    outcome = 'kept the live listings';
  } else if (!live) {
    // Without a copy to fall back on, publishing nothing leaves the site's current listings in place.
    outcome = "couldn't fetch the live listings to keep, so nothing was published";
    process.exitCode = 1;
  } else if (fresh?.categories) outcome = 'published anyway, as the live listings have run out';
  else outcome = 'nothing usable to publish';
  const summary = `${label}: ${issues.join('; ')}; ${outcome}`;
  console.log(summary);
  // A forced run was deliberate, so it doesn't need an alert.
  if (!force) problems.push(summary);
}

if (problems.length && process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `problem=${problems.join(' | ')}\n`);
