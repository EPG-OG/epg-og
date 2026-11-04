// Finds official dark-background versions of channel logos and records them in dark-logos.json.
// The US feed's logos are the "_ll_" (light background) artwork, which is hard to read on the
// app's dark grid; Gracenote usually has a matching "_ld_" version.
//
// Usage: node scripts/find-dark-logos.mjs   (reads epg/us.json; re-run after adding channels)

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logoContrast } from './logo-bounds.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'scripts', 'dark-logos.json');
const SUFFIXES = ['aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah'];

const guide = JSON.parse(await readFile(path.join(root, 'epg', 'us.json'), 'utf8'));
const known = JSON.parse(await readFile(outFile, 'utf8').catch(() => '{}'));
const channels = guide.categories.flatMap((c) => c.channels).filter((c) => /_ll_h\d+_/.test(c.logo ?? ''));

const exists = async (url) => (await fetch(url, { method: 'HEAD' })).ok;
const fetchPng = async (url) => Buffer.from(await (await fetch(url)).arrayBuffer());

/** Newest "_ld_" version of a logo: the same height if it has one, else other common heights. */
async function findDarkVersion(logo) {
  const [, base, height, query] = logo.match(/^(.*\/s\d+)_ll_(h\d+)_[a-z]+\.png(\?.*)?$/) ?? [];
  if (!base) return undefined;
  for (const h of new Set([height, 'h15', 'h9', 'h3'])) {
    const hits = [];
    for (const suffix of SUFFIXES) {
      const url = `${base}_ld_${h}_${suffix}.png${query ?? ''}`;
      if (await exists(url)) hits.push(url);
    }
    if (hits.length) return hits.at(-1);
  }
  return undefined;
}

const found = { ...known };
const queue = [...channels];
const report = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const c = queue.shift();
      const url = await findDarkVersion(c.logo).catch(() => undefined);
      if (!url) {
        report.push(`  -  ${c.name}: no dark version`);
        continue;
      }
      const [before, after] = await Promise.all([fetchPng(c.logo), fetchPng(url)]).then((pair) => pair.map(logoContrast));
      if (after && (!before || after.darkShare <= before.darkShare)) {
        found[c.id] = url;
        report.push(`  ok ${c.name}: ${Math.round((before?.darkShare ?? 0) * 100)}% -> ${Math.round(after.darkShare * 100)}% dark`);
      } else {
        report.push(`  -  ${c.name}: dark version is no better`);
      }
    }
  }),
);

await writeFile(outFile, JSON.stringify(found, null, 2) + '\n');
console.log(report.sort().join('\n'));
console.log(`${Object.keys(found).length} channels use a dark-background logo`);
