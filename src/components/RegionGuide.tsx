import { useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GUIDE_HOURS_AHEAD, GUIDE_HOURS_BACK } from '../config';
import type { Channel, Programme, RegionKey } from '../epg/types';
import { useGuide } from '../epg/useGuide';
import { usePreferences } from '../preferences/PreferencesContext';
import { COMPACT_TEXT, colors } from '../theme';
import { floorToHalfHour, nowSeconds } from '../time';
import { useNow } from '../useNow';
import { CategoryBar } from './CategoryBar';
import { GuideGrid } from './GuideGrid';
import { HeaderActions } from './HeaderActions';
import { ListingsMessage } from './ListingsMessage';
import { ProgrammeSheet } from './ProgrammeSheet';
import { RaceTrack } from './RaceTrack';
import { RetroTitle } from './RetroTitle';
import { TITLE_ART } from './titleArt';
import { TitleInvasion, useRareInvasion, type Box } from './TitleInvasion';
import { UpdateBanner } from './UpdateBanner';

const ALL = 'all';

export function RegionGuide({ region, title }: { region: RegionKey; title: string }) {
  const { guide, error, refresh } = useGuide(region);
  const now = useNow();
  const { loaded, lastCategory, setLastCategory } = usePreferences();
  const [selection, setSelection] = useState<{ channel: Channel; programme: Programme }>();

  // Now and then on phones, flying saucers blow the title apart and fighter jets save the day
  // (TitleInvasion.tsx). Holding the title down calls them in.
  const { width: screenW } = useWindowDimensions();
  const phone = screenW < 700;
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [invasion, setInvasion] = useState(0);
  const [bar, setBar] = useState({ w: 0, h: 0 });
  const [titleBox, setTitleBox] = useState<Box | null>(null);
  const [subtitleBox, setSubtitleBox] = useState<Box | null>(null);
  const invade = useCallback(() => setInvasion((n) => n || Date.now()), []);
  const endInvasion = useCallback(() => setInvasion(0), []);
  useRareInvasion(phone && focused, invade);

  // The window is fixed per data load so the grid doesn't shift under the user's thumb.
  const window = useMemo(() => {
    if (!guide) return undefined;
    const from = Math.max(guide.from, floorToHalfHour(nowSeconds()) - GUIDE_HOURS_BACK * 3600);
    const to = Math.min(guide.to, from + (GUIDE_HOURS_BACK + GUIDE_HOURS_AHEAD) * 3600);
    return { from, to };
  }, [guide]);

  const tabs = useMemo(
    () => [...(guide?.categories ?? []).map(({ id, name }) => ({ id, name })), { id: ALL, name: 'All Channels' }],
    [guide],
  );

  // A saved category may no longer exist if the line-up has changed.
  const saved = lastCategory[region];
  const category = saved && tabs.some((t) => t.id === saved) ? saved : 'sports';

  const channels = useMemo(() => {
    if (!guide) return [];
    if (category === ALL) return guide.categories.flatMap((c) => c.channels);
    return guide.categories.find((c) => c.id === category)?.channels ?? [];
  }, [guide, category]);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.titleBar} onLayout={(e) => setBar({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Pressable
          onLongPress={phone ? invade : undefined}
          delayLongPress={700}
          style={invasion ? styles.hidden : undefined}
          onLayout={(e) => {
            const { x, y, height } = e.nativeEvent.layout;
            const art = TITLE_ART[region];
            setTitleBox({ x, y: y + height - art.height, w: art.width, h: art.height });
          }}
        >
          <RetroTitle text={title} region={region} />
        </Pressable>
        <Text
          style={[styles.subtitle, invasion ? styles.hidden : undefined]}
          numberOfLines={1}
          maxFontSizeMultiplier={COMPACT_TEXT}
          onLayout={(e) => setSubtitleBox({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y, w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          TV Guide
        </Text>
        {invasion > 0 && titleBox && (
          <TitleInvasion
            key={invasion}
            region={region}
            title={titleBox}
            subtitle={subtitleBox}
            subtitleStyle={styles.subtitle}
            top={insets.top}
            width={bar.w}
            height={bar.h}
            onDone={endInvasion}
          />
        )}
        <RaceTrack region={region} />
        <View style={styles.actions}>
          <HeaderActions />
        </View>
      </View>
      <UpdateBanner />
      {/* Redrawn when the categories arrive, so it can scroll to the selected one. */}
      <CategoryBar key={tabs.length} categories={tabs} selected={category} onSelect={(id) => setLastCategory(region, id)} />

      {!guide || !window || !loaded ? (
        error ? (
          <ListingsMessage message="Couldn't load the listings. Check your connection and try again." onRetry={refresh} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )
      ) : window.to <= now ? (
        <ListingsMessage message="These listings are out of date. Check your connection and try again." onRetry={refresh} />
      ) : (
        <GuideGrid
          key={`${region}:${category}`}
          region={region}
          channels={channels}
          from={window.from}
          to={window.to}
          now={now}
          onOpen={(channel, programme) => setSelection({ channel, programme })}
        />
      )}

      <ProgrammeSheet region={region} selection={selection} now={now} onClose={() => setSelection(undefined)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  titleBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 14, paddingTop: 8 },
  subtitle: { color: colors.textDim, fontSize: 15, fontWeight: '600', marginBottom: 6 },
  hidden: { opacity: 0 },
  actions: { marginLeft: 'auto', alignSelf: 'center', padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
