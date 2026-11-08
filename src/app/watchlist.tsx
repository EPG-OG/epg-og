import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChannelLogo } from '../components/ChannelLogo';
import { FollowingPanel } from '../components/FollowingPanel';
import { REMINDER_OPTIONS, usePreferences } from '../preferences/PreferencesContext';
import { colors } from '../theme';
import { formatDay, formatRange } from '../time';
import { useNow } from '../useNow';
import { remindersSupported } from '../watchlist/reminders';
import { useWatchlist, type WatchItem } from '../watchlist/WatchlistContext';

export default function WatchlistScreen() {
  const { items, remove, follows } = useWatchlist();
  const { reminderMinutes, setReminderMinutes } = usePreferences();
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
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close watchlist"
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Watchlist</Text>
      </View>
      <View style={styles.reminderRow}>
        <Ionicons name="notifications-outline" size={15} color={colors.textDim} />
        <Text style={styles.hint}>Remind me</Text>
        {REMINDER_OPTIONS.map((minutes) => {
          const active = minutes === reminderMinutes;
          return (
            <Pressable
              key={minutes}
              onPress={() => setReminderMinutes(minutes)}
              hitSlop={6}
              style={[styles.reminderChip, active && styles.reminderChipActive]}
              accessibilityRole="radio"
              accessibilityLabel={`Remind me ${minutes} minutes before`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.reminderText, active && styles.reminderTextActive]}>{minutes} min</Text>
            </Pressable>
          );
        })}
        <Text style={styles.hint}>before</Text>
      </View>
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
              <ChannelLogo uri={item.logo} crop={item.logoCrop} dark={item.logoDark} name={item.channelName} width={56} height={24} />
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
  titleBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  reminderRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, rowGap: 8, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  hint: { color: colors.textDim, fontSize: 13 },
  reminderChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: colors.divider },
  reminderChipActive: { borderColor: colors.accent },
  reminderText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  reminderTextActive: { color: colors.accent },
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
