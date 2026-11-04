import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Preferences = {
  /** False until saved preferences have been read from the phone. */
  loaded: boolean;
  /** Favourite channel ids, in the order they were added. Ids are unique across countries. */
  favourites: string[];
  isFavourite: (channelId: string) => boolean;
  toggleFavourite: (channelId: string) => void;
  /** Tab route names in the user's order; empty means the default order. */
  tabOrder: string[];
  setTabOrder: (order: string[]) => void;
};

const FAVOURITES_KEY = 'favourites:v1';
const TAB_ORDER_KEY = 'tab-order:v1';

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [tabOrder, setTabOrder] = useState<string[]>([]);

  useEffect(() => {
    const read = async (key: string): Promise<string[]> => {
      try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? (JSON.parse(raw) as string[]) : [];
      } catch {
        return [];
      }
    };
    Promise.all([read(FAVOURITES_KEY), read(TAB_ORDER_KEY)]).then(([savedFavourites, savedOrder]) => {
      setFavourites(savedFavourites);
      setTabOrder(savedOrder);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites)).catch(() => {});
  }, [favourites, loaded]);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(tabOrder)).catch(() => {});
  }, [tabOrder, loaded]);

  const favouriteSet = useMemo(() => new Set(favourites), [favourites]);
  const isFavourite = useCallback((channelId: string) => favouriteSet.has(channelId), [favouriteSet]);
  const toggleFavourite = useCallback((channelId: string) => {
    setFavourites((prev) => (prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]));
  }, []);

  const value = useMemo(
    () => ({ loaded, favourites, isFavourite, toggleFavourite, tabOrder, setTabOrder }),
    [loaded, favourites, isFavourite, toggleFavourite, tabOrder],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
