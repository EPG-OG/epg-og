import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Channel, LogoCrop, Programme, RegionKey } from '../epg/types';
import { nowSeconds } from '../time';
import { cancelReminder, scheduleReminder } from './reminders';

export type WatchItem = {
  key: string;
  region: RegionKey;
  channelId: string;
  channelName: string;
  channelNumber: number;
  logo?: string;
  logoCrop?: LogoCrop;
  title: string;
  subtitle?: string;
  s: number;
  e: number;
  reminderId?: string;
};

type Watchlist = {
  items: WatchItem[];
  isSaved: (channelId: string, start: number) => boolean;
  toggle: (region: RegionKey, channel: Channel, programme: Programme) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

const STORAGE_KEY = 'watchlist:v1';
const keyOf = (channelId: string, start: number) => `${channelId}@${start}`;

const WatchlistContext = createContext<Watchlist | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const saved: WatchItem[] = raw ? JSON.parse(raw) : [];
        const now = nowSeconds();
        setItems(saved.filter((i) => i.e > now)); // drop shows that have finished
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items]);

  const keys = useMemo(() => new Set(items.map((i) => i.key)), [items]);
  const isSaved = useCallback((channelId: string, start: number) => keys.has(keyOf(channelId, start)), [keys]);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const remove = useCallback(async (key: string) => {
    const removed = itemsRef.current.find((i) => i.key === key);
    setItems((prev) => prev.filter((i) => i.key !== key));
    await cancelReminder(removed?.reminderId);
  }, []);

  const toggle = useCallback(
    async (region: RegionKey, channel: Channel, p: Programme) => {
      const key = keyOf(channel.id, p.s);
      if (keys.has(key)) return remove(key);

      const item: WatchItem = {
        key,
        region,
        channelId: channel.id,
        channelName: channel.name,
        channelNumber: channel.number,
        logo: channel.logo,
        logoCrop: channel.lc,
        title: p.t,
        subtitle: p.st,
        s: p.s,
        e: p.e,
      };
      // Add first so the icon fills instantly; the reminder id arrives after the permission prompt.
      setItems((prev) => [...prev, item].sort((a, b) => a.s - b.s));
      const reminderId = await scheduleReminder({
        title: p.t,
        channelName: channel.name,
        channelNumber: channel.number,
        start: p.s,
      }).catch(() => undefined);
      if (!reminderId) return;
      // Removed again while the permission prompt was open: don't leave an orphaned reminder.
      if (!itemsRef.current.some((i) => i.key === key)) return cancelReminder(reminderId);
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, reminderId } : i)));
    },
    [keys, remove],
  );

  const value = useMemo(() => ({ items, isSaved, toggle, remove }), [items, isSaved, toggle, remove]);
  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used inside WatchlistProvider');
  return ctx;
}
