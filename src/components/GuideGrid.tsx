import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { isFiller } from '../epg/programme';
import type { Channel, Programme, RegionKey } from '../epg/types';
import { usePreferences } from '../preferences/PreferencesContext';
import { colors } from '../theme';
import { atLocalHour, floorToHalfHour, formatDay, formatRange, formatTime } from '../time';
import { useWatchlist } from '../watchlist/WatchlistContext';
import { ChannelLogo } from './ChannelLogo';

type Props = {
  /** The country of these channels, or a lookup when a list mixes countries (Favourites). */
  region: RegionKey | ((channel: Channel) => RegionKey);
  channels: Channel[];
  from: number;
  to: number;
  now: number;
  onOpen: (channel: Channel, programme: Programme) => void;
};

type Metrics = { wide: boolean; channelW: number; rowH: number; pxPerMin: number; headerH: number };

const GAP = 4;
// Only rows and shows near the screen are drawn; the rest are empty space of the right size.
// Rows beyond the screen to keep ready, and how far to scroll before redrawing (rows must stay smaller).
const ROW_OVERSCAN = 8;
const ROW_REDRAW = 4;
// Where the quick jumps land, phone time.
const TONIGHT_HOUR = 20;
const TOMORROW_HOUR = 9;

function useMetrics(): Metrics {
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  return wide
    ? { wide, channelW: 300, rowH: 78, pxPerMin: 6, headerH: 52 }
    : { wide, channelW: 112, rowH: 64, pxPerMin: 4, headerH: 48 };
}

export function GuideGrid({ region, channels, from, to, now, onOpen }: Props) {
  const m = useMetrics();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const headerRef = useRef<ScrollViewInstance>(null);
  const gridRef = useRef<ScrollViewInstance>(null);
  const [selectedId, setSelectedId] = useState(channels[0]?.id);
  const { isFavourite, toggleFavourite } = usePreferences();
  const [toast, setToast] = useState<{ channel: Channel; added: boolean }>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const toggleChannel = useCallback(
    (channel: Channel) => {
      setToast({ channel, added: !isFavourite(channel.id) });
      toggleFavourite(channel.id);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(undefined), 3500);
    },
    [isFavourite, toggleFavourite],
  );
  // Left edge of the visible timeline, updated once scrolling settles. Titles of shows that
  // began off-screen slide right to stay readable, like a set-top box guide.
  const [viewX, setViewX] = useState(0);
  const scrollX = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Where drawing is centred: the top row and left edge, updated in steps while scrolling.
  const [topRow, setTopRow] = useState(0);
  const [drawX, setDrawX] = useState(0);

  const firstDrawnRow = topRow - ROW_OVERSCAN;
  const lastDrawnRow = topRow + Math.ceil(screenH / m.rowH) + ROW_OVERSCAN;
  const drawFrom = from + ((drawX - screenW * 1.5) / m.pxPerMin) * 60;
  const drawTo = from + ((drawX + screenW * 2.5) / m.pxPerMin) * 60;

  const x = useCallback((t: number) => ((t - from) / 60) * m.pxPerMin, [from, m.pxPerMin]);
  const totalW = x(to);
  const slots = useMemo(() => {
    const out: number[] = [];
    for (let t = floorToHalfHour(from); t < to; t += 1800) if (t >= from) out.push(t);
    return out;
  }, [from, to]);

  const scrollToTime = useCallback(
    (t: number, animated: boolean) => {
      const target = Math.max(0, x(t));
      gridRef.current?.scrollTo({ x: target, animated });
      headerRef.current?.scrollTo({ x: target, animated });
      scrollX.current = target;
      setViewX(target);
      setDrawX(target);
    },
    [x],
  );

  // Keep at least ~10 minutes of context left of the now-line.
  const nowTarget = floorToHalfHour(now - 600);

  // Only short trips animate: shows far from where the guide is drawn would slide past blank.
  const jump = (t: number) => scrollToTime(t, Math.abs(x(t) - scrollX.current) < screenW);

  const viewTime = from + (viewX / m.pxPerMin) * 60;
  const tonight = atLocalHour(now, 0, TONIGHT_HOUR);
  const tomorrow = atLocalHour(now, 1, 0);
  const tomorrowMorning = atLocalHour(now, 1, TOMORROW_HOUR);
  const showTonight = tonight > nowTarget + 1800 && tonight < to;
  const activeJump =
    viewTime >= tomorrow ? 'tomorrow' : showTonight && viewTime >= tonight - 900 ? 'tonight' : Math.abs(viewTime - nowTarget) < 3600 ? 'now' : undefined;
  const jumps = [
    { id: 'now', label: 'Now', onPress: () => jump(nowTarget) },
    ...(showTonight ? [{ id: 'tonight', label: 'Tonight', onPress: () => jump(tonight) }] : []),
    ...(tomorrowMorning < to ? [{ id: 'tomorrow', label: 'Tomorrow', onPress: () => jump(tomorrowMorning) }] : []),
  ];

  // Open on the current half hour, like a set-top box guide. Done once the grid has laid out
  // (a scrollTo before that is ignored), and again if the scale changes on rotation.
  const opened = useRef(false);
  const openOnNow = () => {
    if (opened.current) return;
    opened.current = true;
    scrollToTime(nowTarget, false);
  };
  useEffect(() => {
    opened.current = false;
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
      <View style={styles.jumps}>
        {jumps.map((j) => {
          const active = j.id === activeJump;
          return (
            <Pressable
              key={j.id}
              onPress={j.onPress}
              hitSlop={6}
              style={[styles.jump, active && styles.jumpActive]}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${j.label.toLowerCase()}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.jumpText, active && styles.jumpTextActive]}>{j.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.header, { height: m.headerH }]}>
        <Pressable onPress={() => jump(nowTarget)} style={[styles.clock, { width: m.channelW }]} accessibilityLabel="Jump to now">
          {m.wide ? (
            <Text style={styles.clockWide}>
              {formatDay(Math.max(viewTime, now))}, {formatTime(now)}
            </Text>
          ) : (
            <>
              <Text style={styles.clockDay}>{formatDay(Math.max(viewTime, now))}</Text>
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

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.gridContent}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const row = Math.floor(e.nativeEvent.contentOffset.y / m.rowH);
          setTopRow((prev) => (Math.abs(prev - row) >= ROW_REDRAW ? row : prev));
        }}
      >
        <View style={styles.row}>
          <View style={{ width: m.channelW }}>
            {channels.map((c, i) =>
              i < firstDrawnRow || i > lastDrawnRow ? (
                <View key={c.id} style={{ height: m.rowH }} />
              ) : (
                <ChannelCell key={c.id} channel={c} selected={c.id === selectedId} favourite={isFavourite(c.id)} m={m} onToggle={toggleChannel} />
              ),
            )}
          </View>
          <ScrollView
            ref={gridRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onContentSizeChange={(w) => w > 0 && openOnNow()}
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.x;
              scrollX.current = offset;
              headerRef.current?.scrollTo({ x: offset, animated: false });
              setDrawX((prev) => (Math.abs(prev - offset) >= screenW / 2 ? offset : prev));
              clearTimeout(settleTimer.current);
              settleTimer.current = setTimeout(() => setViewX(offset), 120);
            }}
          >
            <View style={{ width: totalW }}>
              {channels.map((c, i) =>
                i < firstDrawnRow || i > lastDrawnRow ? (
                  <View key={c.id} style={{ height: m.rowH }} />
                ) : (
                  <ProgrammeRow
                    key={c.id}
                    region={typeof region === 'function' ? region(c) : region}
                    channel={c}
                    selected={c.id === selectedId}
                    now={now}
                    from={from}
                    to={to}
                    drawFrom={drawFrom}
                    drawTo={drawTo}
                    viewX={viewX}
                    m={m}
                    onOpen={selectAndOpen}
                  />
                ),
              )}
              <View pointerEvents="none" style={[styles.nowLine, { left: x(now) }]} />
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {toast && (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Ionicons name={toast.added ? 'star' : 'star-outline'} size={18} color={colors.coffee} />
          <Text style={styles.toastText} numberOfLines={1}>
            {toast.channel.name} {toast.added ? 'added to favourites' : 'removed from favourites'}
          </Text>
          <Pressable
            onPress={() => {
              toggleFavourite(toast.channel.id);
              clearTimeout(toastTimer.current);
              setToast(undefined);
            }}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.toastUndo}>Undo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const ChannelCell = memo(function ChannelCell({
  channel,
  selected,
  favourite,
  m,
  onToggle,
}: {
  channel: Channel;
  selected: boolean;
  favourite: boolean;
  m: Metrics;
  onToggle: (channel: Channel) => void;
}) {
  const star = (size: number) => <Ionicons name={favourite ? 'star' : 'star-outline'} size={size} color={favourite ? colors.coffee : colors.textDim} />;
  const nameStyle = [styles.channelName, selected && styles.selectedText];
  return (
    <Pressable
      onPress={() => onToggle(channel)}
      style={[styles.channel, { height: m.rowH }]}
      accessibilityRole="button"
      accessibilityLabel={`Channel ${channel.number}, ${channel.name}${favourite ? ', favourite' : ''}`}
      accessibilityHint={favourite ? 'Removes from favourites' : 'Adds to favourites'}
    >
      {m.wide ? (
        <View style={styles.channelWide}>
          <Text style={[styles.channelNumberWide, selected && styles.selectedText]}>{channel.number}</Text>
          <ChannelLogo uri={channel.logo} crop={channel.lc} dark={!!channel.dl} name={channel.name} width={84} height={34} />
          <Text style={[nameStyle, styles.channelNameWide]} numberOfLines={1}>
            {channel.name}
          </Text>
          {star(15)}
          {selected && <Ionicons name="play" size={16} color={colors.accent} />}
        </View>
      ) : (
        <>
          <View style={styles.channelTop}>
            <Text style={[styles.channelNumber, selected && styles.selectedText]}>{channel.number}</Text>
            <ChannelLogo uri={channel.logo} crop={channel.lc} dark={!!channel.dl} name={channel.name} width={62} height={24} />
          </View>
          <View style={styles.channelBottom}>
            {selected && <Ionicons name="play" size={10} color={colors.accent} />}
            {star(11)}
            <Text style={nameStyle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
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
  drawFrom,
  drawTo,
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
  drawFrom: number;
  drawTo: number;
  viewX: number;
  m: Metrics;
  onOpen: (c: Channel, p: Programme) => void;
}) {
  const { isSaved, toggle } = useWatchlist();
  const visible = channel.programmes.filter((p) => p.e > Math.max(from, drawFrom) && p.s < Math.min(to, drawTo));
  const next = selected ? channel.programmes.find((p) => p.s >= now) : undefined;

  return (
    <View style={{ height: m.rowH }}>
      {visible.map((p) => {
        const start = Math.max(p.s, from);
        const left = ((start - from) / 60) * m.pxPerMin;
        const width = ((Math.min(p.e, to) - start) / 60) * m.pxPerMin - GAP;
        if (width < 2) return null;

        const airing = p.s <= now && now < p.e;
        const past = p.e <= now;
        const filler = isFiller(p);
        const state = selected && airing ? 'now' : p === next ? 'next' : past || filler ? 'past' : 'normal';
        const onLight = state === 'now';
        const showMeta = !m.wide && width > 70;
        const saved = isSaved(channel.id, p.s);
        // One-tap watchlist toggle on anything that hasn't started yet (and on saved shows, so they can be removed).
        const showSave = width > 84 && ((p.s > now && !filler) || saved);
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
                style={[styles.title, m.wide && styles.titleWide, onLight && styles.titleOnLight, !onLight && (past || filler) && styles.titlePast]}
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
  jumps: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
  jump: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.divider },
  jumpActive: { borderColor: colors.accent },
  jumpText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  jumpTextActive: { color: colors.accent },
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
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  toastText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  toastUndo: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  nowLine: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: colors.accent, opacity: 0.9 },
});
