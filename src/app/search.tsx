import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChannelLogo } from '../components/ChannelLogo';
import { ProgrammeSheet } from '../components/ProgrammeSheet';
import type { Channel, Guide, Programme, RegionKey } from '../epg/types';
import { useGuide } from '../epg/useGuide';
import { usePreferences } from '../preferences/PreferencesContext';
import { colors } from '../theme';
import { formatDay, formatRange } from '../time';
import { useNow } from '../useNow';
import { normalize } from '../watchlist/follows';
import { useWatchlist } from '../watchlist/WatchlistContext';

type Scope = RegionKey | 'all';
type ShowHit = { kind: 'show'; region: RegionKey; channel: Channel; programme: Programme };
type ChannelHit = { kind: 'channel'; region: RegionKey; channel: Channel };
type Row = ShowHit | ChannelHit | { kind: 'header'; title: string };

const MAX_SHOWS = 80;
const scopes: { id: Scope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'us', label: 'USA' },
  { id: 'uk', label: 'UK' },
];

const channelsOf = (guide?: Guide) => guide?.categories.flatMap((c) => c.channels) ?? [];

export default function SearchScreen() {
  const [scope, setScope] = useState<Scope>('all');
  const [query, setQuery] = useState('');
  const [channelView, setChannelView] = useState<ChannelHit>();
  const [selection, setSelection] = useState<{ region: RegionKey; channel: Channel; programme: Programme }>();
  const { guide: us } = useGuide('us');
  const { guide: uk } = useGuide('uk');
  const { isSaved } = useWatchlist();
  const { isFavourite, toggleFavourite } = usePreferences();
  const now = useNow();

  const star = (channel: Channel) => (
    <Pressable
      onPress={() => toggleFavourite(channel.id)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={isFavourite(channel.id) ? `Remove ${channel.name} from favourites` : `Add ${channel.name} to favourites`}
    >
      <Ionicons name={isFavourite(channel.id) ? 'star' : 'star-outline'} size={22} color={isFavourite(channel.id) ? colors.coffee : colors.textDim} />
    </Pressable>
  );

  const regions = useMemo(
    () =>
      ([['us', us], ['uk', uk]] as const).filter(([r, g]) => g && (scope === 'all' || scope === r)) as [RegionKey, Guide][],
    [us, uk, scope],
  );

  const rows = useMemo<Row[]>(() => {
    if (channelView) {
      return channelView.channel.programmes
        .filter((p) => p.e > now)
        .slice(0, 40)
        .map((programme) => ({ kind: 'show', region: channelView.region, channel: channelView.channel, programme }));
    }
    const q = normalize(query);
    if (q.length < 2) return [];
    const channels: ChannelHit[] = [];
    const shows: ShowHit[] = [];
    for (const [region, guide] of regions) {
      for (const channel of channelsOf(guide)) {
        if (normalize(channel.name).includes(q)) channels.push({ kind: 'channel', region, channel });
        for (const programme of channel.programmes)
          if (programme.e > now && normalize(programme.t).includes(q)) shows.push({ kind: 'show', region, channel, programme });
      }
    }
    shows.sort((a, b) => a.programme.s - b.programme.s || a.channel.number - b.channel.number);
    const out: Row[] = [];
    if (channels.length) out.push({ kind: 'header', title: `Channels (${channels.length})` }, ...channels);
    if (shows.length)
      out.push(
        { kind: 'header', title: shows.length > MAX_SHOWS ? `Shows (first ${MAX_SHOWS} of ${shows.length})` : `Shows (${shows.length})` },
        ...shows.slice(0, MAX_SHOWS),
      );
    return out;
  }, [query, regions, now, channelView]);

  const q = normalize(query);
  const empty = channelView
    ? 'No more listings for this channel yet.'
    : q.length < 2
      ? 'Search for a show, team or channel, e.g. "Bake Off", "NFL", "ESPN".'
      : `Nothing coming up for "${query.trim()}".`;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => (channelView ? setChannelView(undefined) : router.back())}
          hitSlop={10}
          accessibilityLabel={channelView ? 'Back to search results' : 'Close search'}
        >
          <Ionicons name={channelView ? 'arrow-back' : 'close'} size={26} color={colors.text} />
        </Pressable>
        {channelView ? (
          <View style={styles.channelHead}>
            <ChannelLogo uri={channelView.channel.logo} crop={channelView.channel.lc} dark={!!channelView.channel.dl} name={channelView.channel.name} width={56} height={24} />
            <Text style={styles.channelHeadText} numberOfLines={1}>
              {channelView.channel.number} · {channelView.channel.name}
            </Text>
            {star(channelView.channel)}
          </View>
        ) : (
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={18} color={colors.textDim} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Shows, teams or channels"
              placeholderTextColor={colors.textDim}
              style={styles.input}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.textDim} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {!channelView && (
        <View style={styles.scopes}>
          {scopes.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setScope(s.id)}
              style={[styles.scope, scope === s.id && styles.scopeOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === s.id }}
            >
              <Text style={[styles.scopeText, scope === s.id && styles.scopeTextOn]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={rows}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(r, i) => (r.kind === 'header' ? `h${i}` : r.kind === 'channel' ? `c${r.region}${r.channel.id}` : `s${r.region}${r.channel.id}${r.programme.s}`)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
        renderItem={({ item }) => {
          if (item.kind === 'header') return <Text style={styles.header}>{item.title}</Text>;
          if (item.kind === 'channel')
            return (
              <Pressable style={styles.row} onPress={() => setChannelView(item)} accessibilityLabel={`${item.channel.name} schedule`}>
                <ChannelLogo uri={item.channel.logo} crop={item.channel.lc} dark={!!item.channel.dl} name={item.channel.name} width={56} height={24} />
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.channel.name}
                  </Text>
                  <Text style={styles.meta}>
                    Channel {item.channel.number} · {item.region.toUpperCase()} · See schedule
                  </Text>
                </View>
                {star(item.channel)}
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>
            );
          const { programme: p, channel, region } = item;
          const airing = p.s <= now && now < p.e;
          return (
            <Pressable style={styles.row} onPress={() => setSelection({ region, channel, programme: p })} accessibilityLabel={`${p.t}, ${formatRange(p.s, p.e)}`}>
              {!channelView && <ChannelLogo uri={channel.logo} crop={channel.lc} dark={!!channel.dl} name={channel.name} width={56} height={24} />}
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>
                  {p.t}
                </Text>
                <Text style={[styles.meta, airing && styles.onNow]} numberOfLines={1}>
                  {airing ? 'On now · ' : `${formatDay(p.s)} · `}
                  {formatRange(p.s, p.e)}
                  {channelView ? '' : ` · ${channel.number} ${channel.name} · ${region.toUpperCase()}`}
                </Text>
              </View>
              {isSaved(channel.id, p.s) && <Ionicons name="bookmark" size={18} color={colors.accent} />}
            </Pressable>
          );
        }}
      />

      <ProgrammeSheet
        region={selection?.region ?? 'us'}
        selection={selection}
        now={now}
        onClose={() => setSelection(undefined)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cell,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 10, outlineStyle: 'none' } as object,
  channelHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelHeadText: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  scopes: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 6 },
  scope: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.cell },
  scopeOn: { backgroundColor: colors.cellNow },
  scopeText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  scopeTextOn: { color: colors.textOnLight },
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  header: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6, marginLeft: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.cell, borderRadius: 6, padding: 12, marginBottom: 6 },
  info: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  onNow: { color: colors.accent },
  empty: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 48, paddingHorizontal: 24, lineHeight: 20 },
});
