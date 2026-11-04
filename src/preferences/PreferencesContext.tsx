import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { RegionKey } from '../epg/types';

export const REMINDER_OPTIONS = [5, 15, 30];

type Preferences = {
  /** False until saved preferences have been read from the phone. */
  loaded: boolean;
  /** Favourite channel ids, in the user's order. Ids are unique across countries. */
  favourites: string[];
  isFavourite: (channelId: string) => boolean;
  toggleFavourite: (channelId: string) => void;
  setFavourites: Dispatch<SetStateAction<string[]>>;
  /** Tab route names in the user's order; empty means the default order. */
  tabOrder: string[];
  setTabOrder: (order: string[]) => void;
  /** How long before a show its reminder fires. */
  reminderMinutes: number;
  setReminderMinutes: (minutes: number) => void;
  /** The category last open in each country's guide. */
  lastCategory: Partial<Record<RegionKey, string>>;
  setLastCategory: (region: RegionKey, category: string) => void;
};

const FAVOURITES_KEY = 'favourites:v1';
const TAB_ORDER_KEY = 'tab-order:v1';
const REMINDER_MINUTES_KEY = 'reminder-minutes:v1';
const LAST_CATEGORY_KEY = 'last-category:v1';

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState(REMINDER_OPTIONS[0]);
  const [lastCategory, setLastCategories] = useState<Preferences['lastCategory']>({});

  useEffect(() => {
    const read = async <T,>(key: string, fallback: T): Promise<T> => {
      try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    Promise.all([
      read<string[]>(FAVOURITES_KEY, []),
      read<string[]>(TAB_ORDER_KEY, []),
      read(REMINDER_MINUTES_KEY, REMINDER_OPTIONS[0]),
      read<Preferences['lastCategory']>(LAST_CATEGORY_KEY, {}),
    ]).then(([savedFavourites, savedOrder, savedMinutes, savedCategories]) => {
      setFavourites(savedFavourites);
      setTabOrder(savedOrder);
      if (REMINDER_OPTIONS.includes(savedMinutes)) setReminderMinutes(savedMinutes);
      setLastCategories(savedCategories);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites)).catch(() => {});
  }, [favourites, loaded]);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(tabOrder)).catch(() => {});
  }, [tabOrder, loaded]);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(REMINDER_MINUTES_KEY, JSON.stringify(reminderMinutes)).catch(() => {});
  }, [reminderMinutes, loaded]);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(LAST_CATEGORY_KEY, JSON.stringify(lastCategory)).catch(() => {});
  }, [lastCategory, loaded]);

  const favouriteSet = useMemo(() => new Set(favourites), [favourites]);
  const isFavourite = useCallback((channelId: string) => favouriteSet.has(channelId), [favouriteSet]);
  const toggleFavourite = useCallback((channelId: string) => {
    setFavourites((prev) => (prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]));
  }, []);
  const setLastCategory = useCallback((region: RegionKey, category: string) => {
    setLastCategories((prev) => ({ ...prev, [region]: category }));
  }, []);

  const value = useMemo(
    () => ({ loaded, favourites, isFavourite, toggleFavourite, setFavourites, tabOrder, setTabOrder, reminderMinutes, setReminderMinutes, lastCategory, setLastCategory }),
    [loaded, favourites, isFavourite, toggleFavourite, tabOrder, reminderMinutes, lastCategory, setLastCategory],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
