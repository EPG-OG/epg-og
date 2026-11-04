import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GUIDE_HOURS_AHEAD, GUIDE_HOURS_BACK } from '../config';
import type { Channel, Programme, RegionKey } from '../epg/types';
import { useGuide } from '../epg/useGuide';
import { colors } from '../theme';
import { floorToHalfHour, nowSeconds } from '../time';
import { useNow } from '../useNow';
import { CategoryBar } from './CategoryBar';
import { GuideGrid } from './GuideGrid';
import { HeaderActions } from './HeaderActions';
import { ProgrammeSheet } from './ProgrammeSheet';
import { UpdateBanner } from './UpdateBanner';

const ALL = 'all';

export function RegionGuide({ region, title }: { region: RegionKey; title: string }) {
  const { guide, error } = useGuide(region);
  const now = useNow();
  const [category, setCategory] = useState('sports');
  const [selection, setSelection] = useState<{ channel: Channel; programme: Programme }>();

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

  const channels = useMemo(() => {
    if (!guide) return [];
    if (category === ALL) return guide.categories.flatMap((c) => c.channels);
    return guide.categories.find((c) => c.id === category)?.channels ?? [];
  }, [guide, category]);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>TV Guide</Text>
        <View style={styles.actions}>
          <HeaderActions />
        </View>
      </View>
      <UpdateBanner />
      <CategoryBar categories={tabs} selected={category} onSelect={setCategory} />

      {!guide || !window ? (
        <View style={styles.center}>
          {error ? <Text style={styles.message}>Couldn't load listings.{'\n'}{error}</Text> : <ActivityIndicator color={colors.accent} />}
        </View>
      ) : window.to <= now ? (
        <View style={styles.center}>
          <Text style={styles.message}>These listings are out of date. Check your connection and reopen the app.</Text>
        </View>
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
  titleBar: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 14, paddingTop: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  actions: { marginLeft: 'auto', alignSelf: 'center', padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  message: { color: colors.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
