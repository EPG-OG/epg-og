import { useCallback, useEffect, useState } from 'react';
import { EPG_BASE_URL } from '../config';
import { readSavedGuide, writeSavedGuide } from './savedGuide';
import type { Guide, RegionKey } from './types';

export const REFRESH_MS = 60 * 60 * 1000;
// The listings are rebuilt every 6 hours (.github/workflows/epg.yml), so a saved copy younger
// than that can't have a newer version to download.
const REBUILD_MS = 6 * 60 * 60 * 1000;
const memory: Partial<Record<RegionKey, { guide: Guide; fetchedAt: number }>> = {};
const inflight: Partial<Record<RegionKey, Promise<Guide>>> = {};
const saved: Partial<Record<RegionKey, Promise<Guide | undefined>>> = {};

const savedCopy = (region: RegionKey) => (saved[region] ??= readSavedGuide(region));

async function load(region: RegionKey): Promise<Guide> {
  const copy = await savedCopy(region);
  if (copy && Date.now() - copy.generatedAt * 1000 < REBUILD_MS) return copy;
  try {
    const res = await fetch(`${EPG_BASE_URL.replace(/\/$/, '')}/${region}.json`);
    if (res.ok) {
      const json = await res.text();
      const guide = JSON.parse(json) as Guide;
      saved[region] = Promise.resolve(guide);
      writeSavedGuide(region, json);
      return guide;
    }
  } catch {
    // Offline or host down: fall through to the saved copy.
  }
  if (copy) return copy;
  throw new Error('No listings available');
}

/** Guide for a region, reusing a copy fetched within `maxAgeMs` and sharing in-flight requests. */
export function fetchGuide(region: RegionKey, maxAgeMs = REFRESH_MS): Promise<Guide> {
  const cached = memory[region];
  if (cached && Date.now() - cached.fetchedAt < maxAgeMs) return Promise.resolve(cached.guide);
  inflight[region] ??= load(region)
    .then((guide) => {
      memory[region] = { guide, fetchedAt: Date.now() };
      return guide;
    })
    .finally(() => {
      delete inflight[region];
    });
  return inflight[region];
}

export function useGuide(region: RegionKey) {
  const [guide, setGuide] = useState<Guide | undefined>(memory[region]?.guide);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const g = await fetchGuide(region, 0);
      setGuide(g);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [region]);

  useEffect(() => {
    let active = true;
    const cached = memory[region];
    // Another screen may have finished loading it since this one first drew.
    if (cached) setGuide((current) => current ?? cached.guide);
    if (!cached || Date.now() - cached.fetchedAt > REFRESH_MS) {
      // Show the saved copy straight away, even if a newer one is on its way.
      savedCopy(region).then((copy) => {
        if (active && copy) setGuide((current) => current ?? copy);
      });
      refresh();
    }
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [region, refresh]);

  return { guide, error, refresh };
}
