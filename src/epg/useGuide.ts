import { useCallback, useEffect, useState } from 'react';
import { EPG_BASE_URL } from '../config';
import type { Guide, RegionKey } from './types';

const bundled: Record<RegionKey, () => Guide> = {
  us: () => require('../../epg/us.json'),
  uk: () => require('../../epg/uk.json'),
};

const REFRESH_MS = 60 * 60 * 1000;
const memory: Partial<Record<RegionKey, { guide: Guide; fetchedAt: number }>> = {};

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

export function useGuide(region: RegionKey) {
  const [guide, setGuide] = useState<Guide | undefined>(memory[region]?.guide);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const g = await load(region);
      memory[region] = { guide: g, fetchedAt: Date.now() };
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
