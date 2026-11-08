import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FavouritesPicker } from '../../components/FavouritesPicker';
import { GuideGrid } from '../../components/GuideGrid';
import { HeaderActions } from '../../components/HeaderActions';
import { ListingsMessage } from '../../components/ListingsMessage';
import { ProgrammeSheet } from '../../components/ProgrammeSheet';
import { UpdateBanner } from '../../components/UpdateBanner';
import { GUIDE_HOURS_AHEAD, GUIDE_HOURS_BACK } from '../../config';
import type { Channel, Programme, RegionKey } from '../../epg/types';
import { useGuide } from '../../epg/useGuide';
import { usePreferences } from '../../preferences/PreferencesContext';
import { colors } from '../../theme';
import { floorToHalfHour, nowSeconds } from '../../time';
import { useNow } from '../../useNow';

const HINT_KEY = 'favourites-hint-done:v1';

export default function FavouritesScreen() {
  const { favourites, setFavourites } = usePreferences();
  const { guide: us, error: usError, refresh: refreshUs } = useGuide('us');
  const { guide: uk, error: ukError, refresh: refreshUk } = useGuide('uk');
  const now = useNow();
  const retry = () => {
    refreshUs();
    refreshUk();
  };
  const [picking, setPicking] = useState(false);
  const [selection, setSelection] = useState<{ channel: Channel; programme: Programme }>();

  const guides = useMemo(() => ({ us, uk }), [us, uk]);

  // Every channel by id, remembering which country it belongs to.
  const lookup = useMemo(() => {
    const map = new Map<string, { channel: Channel; region: RegionKey }>();
    for (const region of ['us', 'uk'] as const)
      for (const category of guides[region]?.categories ?? [])
        for (const channel of category.channels) map.set(channel.id, { channel, region });
    return map;
  }, [guides]);

  const channels = useMemo(() => favourites.flatMap((id) => lookup.get(id)?.channel ?? []), [favourites, lookup]);
  const regionOf = useCallback((channel: Channel) => lookup.get(channel.id)?.region ?? 'us', [lookup]);

  // Shown until they've moved or removed something, so they know it's possible.
  const [hintDone, setHintDone] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(HINT_KEY)
      .then((done) => setHintDone(!!done))
      .catch(() => {});
  }, []);
  const finishHint = useCallback(() => {
    setHintDone(true);
    AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
  }, []);

  const arrange = useMemo(
    () => ({
      onReorder: (ids: string[]) => {
        finishHint();
        // Favourites missing from the listings right now keep their places around the moved ones.
        const shown = new Set(ids);
        setFavourites((current) => {
          const inOrder = ids.values();
          return current.map((id) => (shown.has(id) ? (inOrder.next().value ?? id) : id));
        });
      },
      onRemove: (channel: Channel) => {
        finishHint();
        const index = favourites.indexOf(channel.id);
        setFavourites((current) => current.filter((id) => id !== channel.id));
        return () => setFavourites((current) => (current.includes(channel.id) ? current : [...current.slice(0, index), channel.id, ...current.slice(index)]));
      },
    }),
    [favourites, setFavourites, finishHint],
  );

  // Fixed per data load, so the grid doesn't shift under the user's thumb.
  const window = useMemo(() => {
    const loaded = [us, uk].filter((g) => !!g);
    if (!loaded.length) return undefined;
    const from = Math.max(...loaded.map((g) => g.from), floorToHalfHour(nowSeconds()) - GUIDE_HOURS_BACK * 3600);
    const to = Math.min(...loaded.map((g) => g.to), from + (GUIDE_HOURS_BACK + GUIDE_HOURS_AHEAD) * 3600);
    return { from, to };
  }, [us, uk]);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.titleBar}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.5}>
          Favourites
        </Text>
        <View style={styles.actions}>
          {favourites.length > 0 && (
            <Pressable onPress={() => setPicking(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add or remove favourite channels">
              <Ionicons name="add-circle-outline" size={26} color={colors.text} />
            </Pressable>
          )}
          <HeaderActions />
        </View>
      </View>
      <UpdateBanner />

      {!window ? (
        usError && ukError ? (
          <ListingsMessage message="Couldn't load the listings. Check your connection and try again." onRetry={retry} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )
      ) : favourites.length > 0 && window.to <= now ? (
        <ListingsMessage message="These listings are out of date. Check your connection and try again." onRetry={retry} />
      ) : favourites.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="star-outline" size={48} color={colors.divider} />
          <Text style={styles.emptyTitle}>No favourite channels yet</Text>
          <Text style={styles.emptyText}>Pick the channels you actually watch and they'll all be here in one guide. You can also tap any channel's name in the guide to add it.</Text>
          <Pressable onPress={() => setPicking(true)} style={styles.addBtn} accessibilityRole="button">
            <Text style={styles.addText}>Choose channels</Text>
          </Pressable>
          <Text style={styles.tip}>Tip: hold and drag any tab at the bottom to move it.</Text>
        </View>
      ) : (
        <>
          {!hintDone && <Text style={styles.hint}>Hold a channel to move it. Swipe it left to remove it.</Text>}
          <GuideGrid
            key="favourites"
            region={regionOf}
            channels={channels}
            from={window.from}
            to={window.to}
            now={now}
            onOpen={(channel, programme) => setSelection({ channel, programme })}
            arrange={arrange}
          />
        </>
      )}

      <FavouritesPicker visible={picking} guides={guides} onClose={() => setPicking(false)} />
      <ProgrammeSheet
        region={selection ? regionOf(selection.channel) : 'us'}
        selection={selection}
        now={now}
        onClose={() => setSelection(undefined)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 6 },
  emptyText: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  addBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 10 },
  addText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  tip: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 14 },
  hint: { color: colors.textDim, fontSize: 13, paddingHorizontal: 14, paddingBottom: 8 },
});
