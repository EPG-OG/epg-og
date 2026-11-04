// Downloads the XMLTV feeds listed in lineup.mjs, keeps only the lineup's channels
// and a rolling time window, and writes compact JSON the app loads:
//   epg/us.json, epg/uk.json
//
// Usage: node scripts/build-epg.mjs [--out epg] [--hours-back 3] [--hours-ahead 48]
// Raw feeds are cached in .epg-cache/ for 2 hours to avoid re-downloading.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { logoBounds, logoContrast } from './logo-bounds.mjs';
import { regions } from './lineup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const outDir = path.resolve(root, args.out ?? 'epg');
const cacheDir = path.join(root, '.epg-cache');
const hoursBack = Number(args['hours-back'] ?? 3);
const hoursAhead = Number(args['hours-ahead'] ?? 48);
const CACHE_MS = 2 * 60 * 60 * 1000;
const MAX_DESC = 280;
// Official dark-background logos, by channel id (see find-dark-logos.mjs).
const darkLogos = JSON.parse(await readFile(path.join(root, 'scripts', 'dark-logos.json'), 'utf8'));
// A logo needs a light backing if this share of it is too dark to read on the guide's background,
// unless it's a solid badge with its own background (near-full coverage).
const DARK_SHARE = 0.25;
const SOLID_COVERAGE = 0.95;

async function loadFeed(url) {
  await mkdir(cacheDir, { recursive: true });
  const file = path.join(cacheDir, path.basename(new URL(url).pathname));
  try {
    const s = await stat(file);
    if (Date.now() - s.mtimeMs < CACHE_MS) return gunzipSync(await readFile(file)).toString('utf8');
  } catch {}
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return gunzipSync(buf).toString('utf8');
}

// The feed uses a generic placeholder image for some channels; the app shows the name instead.
const realLogo = (logo) => (logo?.includes('/generic/') ? undefined : logo);

const LOGO_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

// Measures the logo (cached on disk) so the app can crop transparent padding and keep it readable.
async function measureLogo(url) {
  const dir = path.join(cacheDir, 'logos');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, createHash('sha1').update(url).digest('hex') + '.png');
  let buf;
  try {
    if (Date.now() - (await stat(file)).mtimeMs < LOGO_CACHE_MS) buf = await readFile(file);
  } catch {}
  if (!buf) {
    try {
      const res = await fetch(url);
      if (!res.ok) return undefined;
      buf = Buffer.from(await res.arrayBuffer());
      await writeFile(file, buf);
    } catch {
      return undefined;
    }
  }
  const contrast = logoContrast(buf);
  return {
    bounds: logoBounds(buf),
    needsBacking: !!contrast && contrast.darkShare >= DARK_SHARE && contrast.coverage < SOLID_COVERAGE,
  };
}

async function mapLimit(items, limit, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: limit }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]] = decode(m[2]);
  return out;
}

function tag(body, name) {
  const m = body.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : undefined;
}

// "20261101060000 +0000" -> unix seconds
function xmltvTime(s) {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-])(\d{2})(\d{2})?/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, se, sign, oh, om = '00'] = m;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  const offset = (sign === '-' ? -1 : 1) * (+oh * 60 + +om) * 60000;
  return Math.round((utc - offset) / 1000);
}

function httpsLogo(src) {
  return src?.replace(/^http:\/\//, 'https://');
}

// Most artwork lives on two hosts; storing just the image id keeps the JSON small (see src/epg/programme.ts).
function artworkId(src) {
  if (!src || src.includes('/generic/')) return undefined;
  const url = httpsLogo(src);
  return url.match(/^https:\/\/dtil\.tmsimg\.com\/assets\/([^.?/]+)\.jpg/)?.[1] ?? url.match(/^https:\/\/images\.metadata\.sky\.com\/pd-image\/([0-9a-f-]{36})\//i)?.[1] ?? url;
}

function parseFeed(xml, wanted, from, to) {
  const channels = new Map();
  for (const m of xml.matchAll(/<channel id="([^"]+)">([\s\S]*?)<\/channel>/g)) {
    const id = decode(m[1]);
    if (!wanted.has(id)) continue;
    const icon = m[2].match(/<icon src="([^"]+)"/);
    channels.set(id, { name: tag(m[2], 'display-name'), logo: icon ? httpsLogo(decode(icon[1])) : undefined });
  }

  const programmes = new Map();
  for (const m of xml.matchAll(/<programme ([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const a = attrs(m[1]);
    if (!wanted.has(a.channel)) continue;
    const s = xmltvTime(a.start);
    const e = xmltvTime(a.stop);
    if (!(e > from && s < to)) continue;

    const body = m[2];
    const title = tag(body, 'title') ?? 'Untitled';
    const categories = [...body.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/g)].map((c) => decode(c[1]).trim());
    const isNew = /<new\s*\/>|<premiere\b/.test(body);
    const isLive = /<live\s*\/>/.test(body) || /^live\b[:\s]/i.test(title) || (isNew && categories.includes('Sports event'));

    const p = { s, e, t: title.replace(/^live[:\s]+/i, '') };
    const sub = tag(body, 'sub-title');
    if (sub && sub !== title) p.st = sub;
    let desc = tag(body, 'desc');
    if (desc) p.d = desc.length > MAX_DESC ? desc.slice(0, MAX_DESC - 1).trimEnd() + '…' : desc;
    if (categories[0]) p.c = categories[categories.length > 1 && categories[0].includes('&') ? 1 : 0];
    if (isNew) p.n = 1;
    if (isLive) p.l = 1;
    const icon = body.match(/<icon src="([^"]+)"/);
    const artwork = icon && artworkId(decode(icon[1]));
    if (artwork) p.i = artwork;

    if (!programmes.has(a.channel)) programmes.set(a.channel, []);
    programmes.get(a.channel).push(p);
  }
  for (const list of programmes.values()) list.sort((x, y) => x.s - y.s);
  return { channels, programmes };
}

async function buildRegion(key, region) {
  console.log(`[${key}] ${region.label}`);
  const now = Math.floor(Date.now() / 1000);
  const from = now - hoursBack * 3600;
  const to = now + hoursAhead * 3600;
  const wanted = new Set(region.categories.flatMap((c) => c.channels.map((ch) => ch.id)));

  const channels = new Map();
  const programmes = new Map();
  for (const url of region.sources) {
    const feed = parseFeed(await loadFeed(url), wanted, from, to);
    for (const [id, ch] of feed.channels) if (!channels.has(id)) channels.set(id, ch);
    for (const [id, list] of feed.programmes) if (!programmes.has(id)) programmes.set(id, list);
  }

  let number = 1;
  const missing = [];
  const empty = [];
  const categories = region.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    channels: cat.channels.flatMap((c) => {
      const meta = channels.get(c.id);
      if (!meta) {
        missing.push(c.id);
        return [];
      }
      if (!programmes.get(c.id)?.length) {
        empty.push(c.id);
        return [];
      }
      return [{ id: c.id, number: number++, name: c.name ?? meta.name ?? c.id, logo: darkLogos[c.id] ?? realLogo(meta.logo), programmes: programmes.get(c.id) }];
    }),
  }));

  await mapLimit(categories.flatMap((c) => c.channels).filter((c) => c.logo), 8, async (c) => {
    const measured = await measureLogo(c.logo);
    if (measured?.bounds) c.lc = measured.bounds;
    if (measured?.needsBacking) c.dl = 1;
  });

  if (missing.length) console.warn(`  ! not in feed, skipped: ${missing.join(', ')}`);
  if (empty.length) console.warn(`  ! no listings in window, skipped: ${empty.join(', ')}`);

  const json = JSON.stringify({ region: key, label: region.label, generatedAt: now, from, to, categories });
  await writeFile(path.join(outDir, `${key}.json`), json);
  const count = categories.reduce((n, c) => n + c.channels.length, 0);
  console.log(`  wrote ${key}.json: ${count} channels, ${(json.length / 1024).toFixed(0)} KB`);
}

await mkdir(outDir, { recursive: true });
for (const [key, region] of Object.entries(regions)) await buildRegion(key, region);
