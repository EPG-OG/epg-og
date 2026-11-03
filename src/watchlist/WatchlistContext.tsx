import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { fetchGuide, REFRESH_MS } from '../epg/useGuide';
import type { Channel, LogoCrop, Programme, RegionKey } from '../epg/types';
import { nowSeconds } from '../time';
import { findAirings, followRegions, MAX_AUTO_ITEMS, normalize, type Follow } from './follows';
import { cancelReminder, ensureReminderPermission, scheduleReminder } from './reminders';

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
  /** Set when the item was added automatically by a followed show. */
  followId?: string;
};

type Watchlist = {
  items: WatchItem[];
  isSaved: (channelId: string, start: number) => boolean;
  toggle: (region: RegionKey, channel: Channel, programme: Programme) => Promise<void>;
  remove: (key: string) => Promise<void>;
  follows: Follow[];
  findFollow: (kind: Follow['kind'], value: string, region: Follow['region']) => Follow | undefined;
  follow: (kind: Follow['kind'], value: string, region: Follow['region']) => Promise<void>;
  unfollow: (id: string) => Promise<void>;
};

const STORAGE_KEY = 'watchlist:v1';
const FOLLOWS_KEY = 'follows:v1';
// Auto-added airings the user removed, so the next sync doesn't add them back.
const SKIPPED_KEY = 'watchlist-skipped:v1';

const keyOf = (channelId: string, start: number) => `${channelId}@${start}`;
const startOfKey = (key: string) => Number(key.slice(key.lastIndexOf('@') + 1));

function itemFor(region: RegionKey, channel: Channel, p: Programme, followId?: string): WatchItem {
  return {
    key: keyOf(channel.id, p.s),
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
    followId,
  };
}

const byStart = (a: WatchItem, b: WatchItem) => a.s - b.s;

const WatchlistContext = createContext<Watchlist | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const followsRef = useRef(follows);
  followsRef.current = follows;
  const skippedRef = useRef(skipped);
  skippedRef.current = skipped;

  useEffect(() => {
    const read = async <T,>(key: string, fallback: T): Promise<T> => {
      try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    Promise.all([read<WatchItem[]>(STORAGE_KEY, []), read<Follow[]>(FOLLOWS_KEY, []), read<string[]>(SKIPPED_KEY, [])]).then(
      ([savedItems, savedFollows, savedSkipped]) => {
        const now = nowSeconds();
        setItems(savedItems.filter((i) => i.e > now)); // drop shows that have finished
        setFollows(savedFollows);
        setSkipped(savedSkipped.filter((k) => startOfKey(k) > now - 86400));
        setLoaded(true);
      },
    );
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, loaded]);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows)).catch(() => {});
  }, [follows, loaded]);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(SKIPPED_KEY, JSON.stringify(skipped)).catch(() => {});
  }, [skipped, loaded]);

  const keys = useMemo(() => new Set(items.map((i) => i.key)), [items]);
  const isSaved = useCallback((channelId: string, start: number) => keys.has(keyOf(channelId, start)), [keys]);

  /** Adds items to the list, then schedules their reminders (permission was asked when following). */
  const addWithReminders = useCallback(async (added: WatchItem[]) => {
    setItems((prev) => [...prev, ...added].sort(byStart));
    for (const item of added) {
      const reminderId = await scheduleReminder({
        title: item.title,
        channelName: item.channelName,
        channelNumber: item.channelNumber,
        start: item.s,
      }).catch(() => undefined);
      if (!reminderId) continue;
      // Removed again while scheduling: don't leave an orphaned reminder.
      if (!itemsRef.current.some((i) => i.key === item.key)) {
        await cancelReminder(reminderId);
        continue;
      }
      setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, reminderId } : i)));
    }
  }, []);

  // Adds upcoming airings of every followed show that aren't on the watchlist yet.
  const syncing = useRef(false);
  const sync = useCallback(async () => {
    const active = followsRef.current;
    if (!active.length || syncing.current) return;
    syncing.current = true;
    try {
      const now = nowSeconds();
      const taken = new Set([...itemsRef.current.map((i) => i.key), ...skippedRef.current]);
      let autoCount = itemsRef.current.filter((i) => i.followId).length;
      const added: WatchItem[] = [];
      const regions = new Set(active.flatMap(followRegions));
      for (const region of regions) {
        const guide = await fetchGuide(region).catch(() => undefined);
        if (!guide) continue;
        for (const f of active) {
          if (!followRegions(f).includes(region)) continue;
          for (const { channel, programme } of findAirings(f, guide, now)) {
            const key = keyOf(channel.id, programme.s);
            if (taken.has(key) || autoCount >= MAX_AUTO_ITEMS) continue;
            taken.add(key);
            autoCount++;
            added.push(itemFor(region, channel, programme, f.id));
          }
        }
      }
      if (added.length) await addWithReminders(added);
    } finally {
      syncing.current = false;
    }
  }, [addWithReminders]);

  // Check for new airings when follows change, hourly, and whenever the app comes back to the front.
  useEffect(() => {
    if (!loaded) return;
    sync();
  }, [loaded, follows, sync]);
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(sync, REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && sync());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [loaded, sync]);

  const remove = useCallback(async (key: string) => {
    const removed = itemsRef.current.find((i) => i.key === key);
    setItems((prev) => prev.filter((i) => i.key !== key));
    if (removed?.followId) setSkipped((prev) => [...prev, key]);
    await cancelReminder(removed?.reminderId);
  }, []);

  const toggle = useCallback(
    async (region: RegionKey, channel: Channel, p: Programme) => {
      const key = keyOf(channel.id, p.s);
      if (keys.has(key)) return remove(key);
      // Add first so the icon fills instantly; the reminder id arrives after the permission prompt.
      await addWithReminders([itemFor(region, channel, p)]);
    },
    [keys, remove, addWithReminders],
  );

  const findFollow = useCallback(
    (kind: Follow['kind'], value: string, region: Follow['region']) =>
      follows.find((f) => f.kind === kind && f.region === region && normalize(f.value) === normalize(value)),
    [follows],
  );

  const follow = useCallback(
    async (kind: Follow['kind'], value: string, region: Follow['region']) => {
      const v = value.trim();
      if (!normalize(v) || findFollow(kind, v, region)) return;
      const f: Follow = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind, value: v, region, createdAt: Date.now() };
      setFollows((prev) => [...prev, f]);
      await ensureReminderPermission().catch(() => false);
    },
    [findFollow],
  );

  const unfollow = useCallback(async (id: string) => {
    setFollows((prev) => prev.filter((f) => f.id !== id));
    // Drop the airings this follow added (manually saved shows stay).
    const dropped = itemsRef.current.filter((i) => i.followId === id);
    setItems((prev) => prev.filter((i) => i.followId !== id));
    for (const i of dropped) await cancelReminder(i.reminderId);
  }, []);

  const value = useMemo(
    () => ({ items, isSaved, toggle, remove, follows, findFollow, follow, unfollow }),
    [items, isSaved, toggle, remove, follows, findFollow, follow, unfollow],
  );
  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used inside WatchlistProvider');
  return ctx;
}
