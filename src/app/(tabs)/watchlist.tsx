import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChannelLogo } from '../../components/ChannelLogo';
import { FollowingPanel } from '../../components/FollowingPanel';
import { colors } from '../../theme';
import { formatDay, formatRange } from '../../time';
import { useNow } from '../../useNow';
import { REMINDER_MINUTES, remindersSupported } from '../../watchlist/reminders';
import { useWatchlist, type WatchItem } from '../../watchlist/WatchlistContext';

export default function WatchlistScreen() {
  const { items, remove, follows } = useWatchlist();
  const now = useNow();
  const upcoming = items.filter((i) => i.e > now);

  const sections = Object.values(
    upcoming.reduce<Record<string, { title: string; data: WatchItem[] }>>((acc, item) => {
      const day = formatDay(item.s);
      (acc[day] ??= { title: day, data: [] }).data.push(item);
      return acc;
    }, {}),
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>Watchlist</Text>
      </View>
      {remindersSupported && upcoming.length > 0 && (
        <Text style={styles.hint}>
          <Ionicons name="notifications-outline" size={13} color={colors.textDim} /> You'll get a notification {REMINDER_MINUTES} min
          before each show starts.
        </Text>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<FollowingPanel />}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
        renderItem={({ item }) => {
          const airing = item.s <= now && now < item.e;
          return (
            <View style={styles.row}>
              <ChannelLogo uri={item.logo} crop={item.logoCrop} name={item.channelName} width={56} height={24} />
              <View style={styles.info}>
                <View style={styles.titleRow}>
                  {item.followId && <Ionicons name="repeat" size={14} color={colors.accent} accessibilityLabel="Added by a followed show" />}
                  <Text style={styles.showTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                {item.subtitle && (
                  <Text style={styles.sub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                )}
                <Text style={[styles.meta, airing && styles.onNow]}>
                  {airing ? 'On now · ' : ''}
                  {formatRange(item.s, item.e)} · {item.channelNumber} {item.channelName} · {item.region.toUpperCase()}
                </Text>
              </View>
              {item.reminderId && !airing && <Ionicons name="notifications" size={16} color={colors.accent} />}
              <Pressable onPress={() => remove(item.key)} hitSlop={10} accessibilityLabel={`Remove ${item.title}`}>
                <Ionicons name="bookmark" size={22} color={colors.accent} />
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={44} color={colors.divider} />
            <Text style={styles.emptyTitle}>{follows.length ? 'Nothing coming up yet' : 'Nothing saved yet'}</Text>
            <Text style={styles.emptyText}>
              {follows.length
                ? 'New airings of the shows you follow will appear here as soon as they are in the listings.'
                : `Tap the bookmark on any upcoming show in the guide to add it here${remindersSupported ? ' and get a reminder before it starts' : ''}.`}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  titleBar: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  hint: { color: colors.textDim, fontSize: 13, paddingHorizontal: 14, paddingBottom: 6 },
  list: { paddingHorizontal: 12, paddingBottom: 24, flexGrow: 1 },
  day: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 6, marginLeft: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cell,
    borderRadius: 6,
    padding: 12,
    marginBottom: 6,
  },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  showTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 1 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  onNow: { color: colors.accent },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
