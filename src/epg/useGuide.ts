import { useCallback, useEffect, useState } from 'react';
import { EPG_BASE_URL } from '../config';
import type { Guide, RegionKey } from './types';

const bundled: Record<RegionKey, () => Guide> = {
  us: () => require('../../epg/us.json'),
  uk: () => require('../../epg/uk.json'),
};

export const REFRESH_MS = 60 * 60 * 1000;
const memory: Partial<Record<RegionKey, { guide: Guide; fetchedAt: number }>> = {};
const inflight: Partial<Record<RegionKey, Promise<Guide>>> = {};

async function load(region: RegionKey): Promise<Guide> {
  if (EPG_BASE_URL) {
    try {
      const res = await fetch(`${EPG_BASE_URL.replace(/\/$/, '')}/${region}.json`);
      if (res.ok) return (await res.json()) as Guide;
    } catch {
      // Offline or host down: fall through to the bundled snapshot.
    }
  }
  return bundled[region]();
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
    const cached = memory[region];
    if (!cached || Date.now() - cached.fetchedAt > REFRESH_MS) refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [region, refresh]);

  return { guide, error, refresh };
}
