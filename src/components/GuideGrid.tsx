import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import type { Channel, Programme, RegionKey } from '../epg/types';
import { colors } from '../theme';
import { floorToHalfHour, formatDay, formatRange, formatTime } from '../time';
import { useWatchlist } from '../watchlist/WatchlistContext';
import { ChannelLogo } from './ChannelLogo';

type Props = {
  region: RegionKey;
  channels: Channel[];
  from: number;
  to: number;
  now: number;
  onOpen: (channel: Channel, programme: Programme) => void;
};

type Metrics = { wide: boolean; channelW: number; rowH: number; pxPerMin: number; headerH: number };

const GAP = 4;

function useMetrics(): Metrics {
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  return wide
    ? { wide, channelW: 300, rowH: 78, pxPerMin: 6, headerH: 52 }
    : { wide, channelW: 112, rowH: 64, pxPerMin: 4, headerH: 48 };
}

export function GuideGrid({ region, channels, from, to, now, onOpen }: Props) {
  const m = useMetrics();
  const headerRef = useRef<ScrollViewInstance>(null);
  const gridRef = useRef<ScrollViewInstance>(null);
  const [selectedId, setSelectedId] = useState(channels[0]?.id);
  // Left edge of the visible timeline, updated once scrolling settles. Titles of shows that
  // began off-screen slide right to stay readable, like a set-top box guide.
  const [viewX, setViewX] = useState(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const x = useCallback((t: number) => ((t - from) / 60) * m.pxPerMin, [from, m.pxPerMin]);
  const totalW = x(to);
  const slots = useMemo(() => {
    const out: number[] = [];
    for (let t = floorToHalfHour(from); t < to; t += 1800) if (t >= from) out.push(t);
    return out;
  }, [from, to]);

  const jumpToNow = useCallback(
    (animated = true) => {
      // Keep at least ~10 minutes of context left of the now-line.
      const target = Math.max(0, x(floorToHalfHour(now - 600)));
      gridRef.current?.scrollTo({ x: target, animated });
      headerRef.current?.scrollTo({ x: target, animated });
      setViewX(target);
    },
    [x, now, m.wide],
  );

  // Open on the current half hour, like a set-top box guide.
  useEffect(() => {
    const id = requestAnimationFrame(() => jumpToNow(false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, m.pxPerMin]);

  const selectAndOpen = useCallback(
    (channel: Channel, p: Programme) => {
      setSelectedId(channel.id);
      onOpen(channel, p);
    },
    [onOpen],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { height: m.headerH }]}>
        <Pressable onPress={() => jumpToNow()} style={[styles.clock, { width: m.channelW }]} accessibilityLabel="Jump to now">
          {m.wide ? (
            <Text style={styles.clockWide}>
              {formatDay(now)}, {formatTime(now)}
            </Text>
          ) : (
            <>
              <Text style={styles.clockDay}>{formatDay(now)}</Text>
              <Text style={styles.clockTime}>{formatTime(now)}</Text>
            </>
          )}
        </Pressable>
        <ScrollView ref={headerRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          <View style={{ width: totalW, height: m.headerH }}>
            {slots.map((t) => (
              <Text key={t} style={[styles.slot, m.wide && styles.slotWide, { left: x(t) + 4 }]}>
                {formatTime(t)}
              </Text>
            ))}
            <View style={[styles.nowDot, { left: x(now) - 5 }]} />
          </View>
        </ScrollView>
      </View>
      <View style={styles.divider} />

      <ScrollView style={styles.root} contentContainerStyle={styles.gridContent}>
        <View style={styles.row}>
          <View style={{ width: m.channelW }}>
            {channels.map((c) => (
              <ChannelCell key={c.id} channel={c} selected={c.id === selectedId} m={m} onPress={() => setSelectedId(c.id)} />
            ))}
          </View>
          <ScrollView
            ref={gridRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.x;
              headerRef.current?.scrollTo({ x: offset, animated: false });
              clearTimeout(settleTimer.current);
              settleTimer.current = setTimeout(() => setViewX(offset), 120);
            }}
          >
            <View style={{ width: totalW }}>
              {channels.map((c) => (
                <ProgrammeRow
                  key={c.id}
                  region={region}
                  channel={c}
                  selected={c.id === selectedId}
                  now={now}
                  from={from}
                  to={to}
                  viewX={viewX}
                  m={m}
                  onOpen={selectAndOpen}
                />
              ))}
              <View pointerEvents="none" style={[styles.nowLine, { left: x(now) }]} />
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const ChannelCell = memo(function ChannelCell({
  channel,
  selected,
  m,
  onPress,
}: {
  channel: Channel;
  selected: boolean;
  m: Metrics;
  onPress: () => void;
}) {
  const nameStyle = [styles.channelName, selected && styles.selectedText];
  return (
    <Pressable onPress={onPress} style={[styles.channel, { height: m.rowH }]} accessibilityLabel={`Channel ${channel.number}, ${channel.name}`}>
      {m.wide ? (
        <View style={styles.channelWide}>
          <Text style={[styles.channelNumberWide, selected && styles.selectedText]}>{channel.number}</Text>
          <ChannelLogo uri={channel.logo} crop={channel.lc} name={channel.name} width={84} height={34} />
          <Text style={[nameStyle, styles.channelNameWide]} numberOfLines={1}>
            {channel.name}
          </Text>
          {selected && <Ionicons name="play" size={16} color={colors.accent} />}
        </View>
      ) : (
        <>
          <View style={styles.channelTop}>
            <Text style={[styles.channelNumber, selected && styles.selectedText]}>{channel.number}</Text>
            <ChannelLogo uri={channel.logo} crop={channel.lc} name={channel.name} width={62} height={24} />
          </View>
          <View style={styles.channelBottom}>
            {selected && <Ionicons name="play" size={10} color={colors.accent} />}
            <Text style={nameStyle} numberOfLines={1}>
              {channel.name}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
});

const ProgrammeRow = memo(function ProgrammeRow({
  region,
  channel,
  selected,
  now,
  from,
  to,
  viewX,
  m,
  onOpen,
}: {
  region: RegionKey;
  channel: Channel;
  selected: boolean;
  now: number;
  from: number;
  to: number;
  viewX: number;
  m: Metrics;
  onOpen: (c: Channel, p: Programme) => void;
}) {
  const { isSaved, toggle } = useWatchlist();
  const visible = channel.programmes.filter((p) => p.e > from && p.s < to);
  const next = selected ? visible.find((p) => p.s >= now) : undefined;

  return (
    <View style={{ height: m.rowH }}>
      {visible.map((p) => {
        const start = Math.max(p.s, from);
        const left = ((start - from) / 60) * m.pxPerMin;
        const width = ((Math.min(p.e, to) - start) / 60) * m.pxPerMin - GAP;
        if (width < 2) return null;

        const airing = p.s <= now && now < p.e;
        const past = p.e <= now;
        const state = selected && airing ? 'now' : p === next ? 'next' : past ? 'past' : 'normal';
        const onLight = state === 'now';
        const showMeta = !m.wide && width > 70;
        const saved = isSaved(channel.id, p.s);
        // One-tap watchlist toggle on anything that hasn't started yet (and on saved shows, so they can be removed).
        const showSave = width > 84 && (p.s > now || saved);
        const inset = Math.max(0, Math.min(viewX - left, width - (showSave ? 130 : 96)));

        return (
          <Pressable
            key={p.s}
            onPress={() => onOpen(channel, p)}
            style={[
              styles.cell,
              { left, width, top: GAP / 2, height: m.rowH - GAP, paddingLeft: 10 + inset, paddingRight: showSave ? 34 : 10 },
              cellBg[state],
              saved && styles.cellSaved,
            ]}
            accessibilityLabel={`${p.t}, ${formatRange(p.s, p.e)}${saved ? ', on watchlist' : ''}`}
          >
            {showSave && (
              <Pressable
                onPress={() => toggle(region, channel, p)}
                hitSlop={8}
                style={styles.saveBtn}
                accessibilityRole="button"
                accessibilityLabel={saved ? `Remove ${p.t} from watchlist` : `Add ${p.t} to watchlist`}
              >
                <Ionicons
                  name={saved ? 'bookmark' : 'bookmark-outline'}
                  size={m.wide ? 20 : 17}
                  color={saved ? colors.accent : onLight ? colors.textOnLight : colors.textDim}
                />
              </Pressable>
            )}
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={[styles.title, m.wide && styles.titleWide, onLight && styles.titleOnLight, past && styles.titlePast]}
              >
                {p.t}
              </Text>
              {p.l ? (
                <Text style={[styles.badge, styles.badgeLive]}>Live</Text>
              ) : p.n ? (
                <Text style={[styles.badge, onLight && styles.titleOnLight]}>New</Text>
              ) : null}
            </View>
            {showMeta && (
              <Text numberOfLines={1} style={[styles.meta, onLight && styles.metaOnLight]}>
                {formatRange(p.s, p.e)}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

const cellBg = StyleSheet.create({
  normal: { backgroundColor: colors.cell },
  past: { backgroundColor: colors.cellPast },
  now: { backgroundColor: colors.cellNow },
  next: { backgroundColor: colors.cellNext },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row' },
  clock: { justifyContent: 'center', paddingLeft: 12 },
  clockWide: { color: colors.accent, fontSize: 22, fontWeight: '600' },
  clockDay: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  clockTime: { color: colors.accent, fontSize: 17, fontWeight: '700' },
  slot: { position: 'absolute', bottom: 10, color: colors.text, fontSize: 14, fontWeight: '600' },
  slotWide: { fontSize: 20 },
  nowDot: { position: 'absolute', bottom: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, zIndex: 2 },
  divider: { height: 1, backgroundColor: colors.divider },
  gridContent: { paddingTop: 4, paddingBottom: 24 },
  row: { flexDirection: 'row' },
  channel: { justifyContent: 'center', paddingHorizontal: 10 },
  channelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  channelBottom: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  channelNumber: { color: colors.text, fontSize: 15, fontWeight: '700', minWidth: 22 },
  channelName: { color: colors.text, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  channelWide: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  channelNumberWide: { color: colors.text, fontSize: 22, fontWeight: '700', width: 34, textAlign: 'center' },
  channelNameWide: { fontSize: 17, flex: 1 },
  selectedText: { color: colors.accent },
  cell: { position: 'absolute', borderRadius: 3, justifyContent: 'center', overflow: 'hidden' },
  cellSaved: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  saveBtn: { position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  titleWide: { fontSize: 19 },
  titleOnLight: { color: colors.textOnLight },
  titlePast: { color: colors.textDim },
  badge: { color: colors.text, fontSize: 10, fontWeight: '700', marginLeft: 6, marginTop: -2 },
  badgeLive: { color: colors.live },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  metaOnLight: { color: '#5c5f66' },
  nowLine: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: colors.accent, opacity: 0.9 },
});
