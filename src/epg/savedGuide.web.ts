import type { Guide, RegionKey } from './types';

// Browsers have no app files, and listings are too big for localStorage.
const CACHE = 'epg-og-guide';
const keyFor = (region: RegionKey) => `/saved/${region}.json`;

export async function readSavedGuide(region: RegionKey): Promise<Guide | undefined> {
  try {
    const res = await (await caches.open(CACHE)).match(keyFor(region));
    return res ? ((await res.json()) as Guide) : undefined;
  } catch {
    return undefined;
  }
}

export async function writeSavedGuide(region: RegionKey, json: string): Promise<void> {
  try {
    await (await caches.open(CACHE)).put(keyFor(region), new Response(json));
  } catch {
    // Storage blocked: the page still has the listings it just downloaded.
  }
}
