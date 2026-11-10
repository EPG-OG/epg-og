import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { isFiller } from '../epg/programme';
import type { Channel, Programme, RegionKey } from '../epg/types';
import { usePreferences } from '../preferences/PreferencesContext';
import { COMPACT_TEXT, colors } from '../theme';
import { atLocalHour, floorToHalfHour, formatDay, formatRange, formatTime } from '../time';
import { useWatchlist } from '../watchlist/WatchlistContext';
import { ArrangeableCell } from './ArrangeableCell';
import { isWebsite } from '../distribution';
import { TIME_SLIDER_HEIGHT, TimeSlider } from './TimeSlider';
import { useMouseDragScroll } from './useMouseDragScroll';
import { ChannelLogo } from './ChannelLogo';

type Props = {
  /** The country of these channels, or a lookup when a list mixes countries (Favourites). */
  region: RegionKey | ((channel: Channel) => RegionKey);
  channels: Channel[];
  from: number;
  to: number;
  now: number;
  onOpen: (channel: Channel, programme: Programme) => void;
  /** Lets channels be held and dragged into a new order, or swiped away, instead of tapped (Favourites). */
  arrange?: {
    onReorder: (ids: string[]) => void;
    /** Returns a function that undoes the removal. */
    onRemove: (channel: Channel) => () => void;
  };
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
// While dragging a channel, how close to the list's edge starts it scrolling, and how fast.
const DRAG_EDGE = 56;
const DRAG_SCROLL_STEP = 8;

const moved = <T,>(list: T[], from: number, to: number) => {
  const out = [...list];
  out.splice(to, 0, ...out.splice(from, 1));
  return out;
};

function useMetrics(): Metrics {
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  return wide
    ? { wide, channelW: 300, rowH: 78, pxPerMin: 6, headerH: 52 }
    : { wide, channelW: 112, rowH: 64, pxPerMin: 4, headerH: 48 };
}

export function GuideGrid({ region, channels, from, to, now, onOpen, arrange }: Props) {
  const m = useMetrics();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const headerRef = useRef<ScrollViewInstance>(null);
  const gridRef = useRef<ScrollViewInstance>(null);
  const [selectedId, setSelectedId] = useState(channels[0]?.id);
  const { isFavourite, toggleFavourite } = usePreferences();
  const [toast, setToast] = useState<{ icon: 'star' | 'star-outline'; text: string; undo?: () => void }>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((next: NonNullable<typeof toast>) => {
    setToast(next);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 3500);
  }, []);

  // Tapping only ever adds, so a stray tap can't lose a favourite.
  const addChannel = useCallback(
    (channel: Channel) => {
      if (isFavourite(channel.id)) {
        showToast({ icon: 'star', text: `${channel.name} is in your favourites. Swipe it left there to remove it.` });
        return;
      }
      toggleFavourite(channel.id);
      showToast({ icon: 'star', text: `${channel.name} added to favourites`, undo: () => toggleFavourite(channel.id) });
    },
    [isFavourite, toggleFavourite, showToast],
  );

  // Holding a channel to drag it: `dy` is how far it has travelled through the list.
  const [drag, setDrag] = useState<{ id: string; start: number; dy: number }>();
  const [listLocked, setListLocked] = useState(false);
  const listBoxRef = useRef<ComponentRef<typeof View>>(null);
  const listRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const listHeight = useRef(0);
  const dragInfo = useRef({ fingerY: 0, fingerDy: 0, startScroll: 0, listTop: 0, timer: undefined as ReturnType<typeof setInterval> | undefined }).current;
  useEffect(() => () => clearInterval(dragInfo.timer), [dragInfo]);

  const targetRow = drag ? Math.min(channels.length - 1, Math.max(0, drag.start + Math.round(drag.dy / m.rowH))) : 0;
  const rowsRef = useRef(channels);
  rowsRef.current = drag ? moved(channels, drag.start, targetRow) : channels;
  // Rows stay where they are in the list until the drag ends and only slide out of the way:
  // moving the row under the finger would cancel the gesture.
  const rowStyle = (i: number) => {
    if (!drag) return undefined;
    if (i === drag.start) return [styles.dragging, { transform: [{ translateY: drag.dy }] }];
    if (i > drag.start && i <= targetRow) return { transform: [{ translateY: -m.rowH }] };
    if (i < drag.start && i >= targetRow) return { transform: [{ translateY: m.rowH }] };
    return undefined;
  };
  const channelCount = useRef(channels.length);
  channelCount.current = channels.length;

  const startDrag = useCallback(
    (channel: Channel, pageY: number) => {
      Object.assign(dragInfo, { fingerY: pageY, fingerDy: 0, startScroll: scrollY.current });
      listBoxRef.current?.measureInWindow((_x, y) => {
        dragInfo.listTop = y;
      });
      setListLocked(true);
      setDrag({ id: channel.id, start: rowsRef.current.findIndex((c) => c.id === channel.id), dy: 0 });
      // Scrolls the list when the finger is held near its top or bottom edge.
      dragInfo.timer = setInterval(() => {
        const nearTop = dragInfo.fingerY < dragInfo.listTop + DRAG_EDGE;
        const nearBottom = dragInfo.fingerY > dragInfo.listTop + listHeight.current - DRAG_EDGE;
        if (nearTop === nearBottom) return;
        const max = Math.max(0, channelCount.current * m.rowH - listHeight.current + 28);
        const next = Math.min(max, Math.max(0, scrollY.current + (nearTop ? -DRAG_SCROLL_STEP : DRAG_SCROLL_STEP)));
        if (next === scrollY.current) return;
        scrollY.current = next;
        listRef.current?.scrollTo({ y: next, animated: false });
        setDrag((d) => d && { ...d, dy: dragInfo.fingerDy + next - dragInfo.startScroll });
      }, 32);
    },
    [dragInfo, m.rowH],
  );
  const moveDrag = useCallback(
    (dy: number, pageY: number) => {
      dragInfo.fingerDy = dy;
      dragInfo.fingerY = pageY;
      setDrag((d) => d && { ...d, dy: dy + scrollY.current - dragInfo.startScroll });
    },
    [dragInfo],
  );
  const endDrag = useCallback(
    (commit: boolean) => {
      clearInterval(dragInfo.timer);
      if (commit) arrange?.onReorder(rowsRef.current.map((c) => c.id));
      setDrag(undefined);
      setListLocked(false);
    },
    [arrange, dragInfo],
  );
  const removeChannel = useCallback(
    (channel: Channel) => {
      if (!arrange) return;
      showToast({ icon: 'star-outline', text: `${channel.name} removed from favourites`, undo: arrange.onRemove(channel) });
    },
    [arrange, showToast],
  );
  const moveChannelBy = useCallback(
    (channel: Channel, step: number) => {
      const index = rowsRef.current.findIndex((c) => c.id === channel.id);
      arrange?.onReorder(moved(rowsRef.current, index, index + step).map((c) => c.id));
    },
    [arrange],
  );
  const showArrangeHint = useCallback(() => showToast({ icon: 'star', text: 'Hold a channel to move it, or swipe it left to remove it.' }), [showToast]);
  const cellGestures = useMemo(
    () => (arrange ? { startDrag, moveDrag, endDrag, removeChannel, moveChannelBy, showArrangeHint, setListLocked } : undefined),
    [arrange, startDrag, moveDrag, endDrag, removeChannel, moveChannelBy, showArrangeHint],
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

  // In the browser, the mouse can grab the guide anywhere and drag it through the day and the
  // channels. On Favourites, a press on a channel is left for moving or removing it.
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const scrollable = (r: typeof gridRef) => (r.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.() ?? null;
  useMouseDragScroll({
    nodes: () => ({ box: rootRef.current as unknown as HTMLElement | null, horizontal: scrollable(gridRef), vertical: scrollable(listRef) }),
    ignore: (e) => {
      if (listLocked || (e.target as Element | null)?.closest?.('[data-time-slider]')) return true;
      if (!arrange) return false;
      const list = (listBoxRef.current as unknown as HTMLElement | null)?.getBoundingClientRect();
      return !!list && e.clientY >= list.top && e.clientX < list.left + m.channelW;
    },
  });

  // On computers, the browser version also gets a time slider under the guide.
  const [showSlider] = useState(() => isWebsite && typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches);

  const selectAndOpen = useCallback(
    (channel: Channel, p: Programme) => {
      setSelectedId(channel.id);
      onOpen(channel, p);
    },
    [onOpen],
  );

  return (
    <View ref={rootRef} style={styles.root}>
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
              <Text maxFontSizeMultiplier={COMPACT_TEXT} style={[styles.jumpText, active && styles.jumpTextActive]}>{j.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.header, { height: m.headerH }]}>
        <Pressable onPress={() => jump(nowTarget)} style={[styles.clock, { width: m.channelW }]} accessibilityLabel="Jump to now">
          {m.wide ? (
            <Text maxFontSizeMultiplier={COMPACT_TEXT} style={styles.clockWide}>
              {formatDay(Math.max(viewTime, now))}, {formatTime(now)}
            </Text>
          ) : (
            <>
              <Text maxFontSizeMultiplier={COMPACT_TEXT} style={styles.clockDay}>{formatDay(Math.max(viewTime, now))}</Text>
              <Text maxFontSizeMultiplier={COMPACT_TEXT} style={styles.clockTime}>{formatTime(now)}</Text>
            </>
          )}
        </Pressable>
        <ScrollView ref={headerRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          <View style={{ width: totalW, height: m.headerH }}>
            {slots.map((t) => (
              <Text maxFontSizeMultiplier={COMPACT_TEXT} key={t} style={[styles.slot, m.wide && styles.slotWide, { left: x(t) + 4 }]}>
                {formatTime(t)}
              </Text>
            ))}
            <View style={[styles.nowDot, { left: x(now) - 5 }]} />
          </View>
        </ScrollView>
      </View>
      <View style={styles.divider} />

      <View
        ref={listBoxRef}
        style={styles.root}
        onLayout={(e) => {
          listHeight.current = e.nativeEvent.layout.height;
        }}
      >
      <ScrollView
        ref={listRef}
        style={styles.root}
        contentContainerStyle={styles.gridContent}
        scrollEnabled={!listLocked}
        scrollEventThrottle={32}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          const row = Math.floor(e.nativeEvent.contentOffset.y / m.rowH);
          setTopRow((prev) => (Math.abs(prev - row) >= ROW_REDRAW ? row : prev));
        }}
      >
        <View style={styles.row}>
          <View style={{ width: m.channelW }}>
            {channels.map((c, i) => {
              return (i < firstDrawnRow || i > lastDrawnRow) && drag?.id !== c.id ? (
                <View key={c.id} style={{ height: m.rowH }} />
              ) : (
                <View key={c.id} style={rowStyle(i)}>
                  <ChannelCell
                    channel={c}
                    selected={c.id === selectedId}
                    favourite={isFavourite(c.id)}
                    m={m}
                    onAdd={addChannel}
                    gestures={cellGestures}
                    canMoveUp={i > 0}
                    canMoveDown={i < channels.length - 1}
                  />
                </View>
              );
            })}
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
              {channels.map((c, i) => {
                return (i < firstDrawnRow || i > lastDrawnRow) && drag?.id !== c.id ? (
                  <View key={c.id} style={{ height: m.rowH }} />
                ) : (
                  <View key={c.id} style={rowStyle(i)}>
                    <ProgrammeRow
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
                  </View>
                );
              })}
              <View pointerEvents="none" style={[styles.nowLine, { left: x(now) }]} />
            </View>
          </ScrollView>
        </View>
      </ScrollView>
      </View>

      {showSlider && (
        <TimeSlider scroller={() => scrollable(gridRef)} from={from} to={to} now={now} pxPerMin={m.pxPerMin} inset={m.channelW} />
      )}

      {toast && (
        <View style={[styles.toast, showSlider && { bottom: 12 + TIME_SLIDER_HEIGHT }]} accessibilityLiveRegion="polite">
          <Ionicons name={toast.icon} size={18} color={colors.coffee} />
          <Text maxFontSizeMultiplier={COMPACT_TEXT} style={styles.toastText} numberOfLines={2}>
            {toast.text}
          </Text>
          {toast.undo && (
            <Pressable
              onPress={() => {
                toast.undo?.();
                clearTimeout(toastTimer.current);
                setToast(undefined);
              }}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text maxFontSizeMultiplier={COMPACT_TEXT} style={styles.toastUndo}>Undo</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

type CellGestures = {
  startDrag: (channel: Channel, pageY: number) => void;
  moveDrag: (dy: number, pageY: number) => void;
  endDrag: (commit: boolean) => void;
  removeChannel: (channel: Channel) => void;
  moveChannelBy: (channel: Channel, step: number) => void;
  showArrangeHint: () => void;
  setListLocked: (locked: boolean) => void;
};

const ChannelCell = memo(function ChannelCell({
  channel,
  selected,
  favourite,
  m,
  onAdd,
  gestures,
  canMoveUp,
  canMoveDown,
}: {
  channel: Channel;
  selected: boolean;
  favourite: boolean;
  m: Metrics;
  onAdd: (channel: Channel) => void;
  gestures?: CellGestures;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const star = (size: number) => <Ionicons name={favourite ? 'star' : 'star-outline'} size={size} color={favourite ? colors.coffee : colors.textDim} />;
  const nameStyle = [styles.channelName, selected && styles.selectedText];
  const label = `Channel ${channel.number}, ${channel.name}${favourite ? ', favourite' : ''}`;
  const content = m.wide ? (
    <View style={styles.channelWide}>
      <Text maxFontSizeMultiplier={COMPACT_TEXT} style={[styles.channelNumberWide, selected && styles.selectedText]}>{channel.number}</Text>
      <ChannelLogo uri={channel.logo} crop={channel.lc} dark={!!channel.dl} name={channel.name} width={84} height={34} />
      <Text maxFontSizeMultiplier={COMPACT_TEXT} style={[nameStyle, styles.channelNameWide]} numberOfLines={1}>
        {channel.name}
      </Text>
      {star(15)}
      {selected && <Ionicons name="play" size={16} color={colors.accent} />}
    </View>
  ) : (
    <>
      <View style={styles.channelTop}>
        <Text maxFontSizeMultiplier={COMPACT_TEXT} style={[styles.channelNumber, selected && styles.selectedText]}>{channel.number}</Text>
        <ChannelLogo uri={channel.logo} crop={channel.lc} dark={!!channel.dl} name={channel.name} width={62} height={24} />
      </View>
      <View style={styles.channelBottom}>
        {selected && <Ionicons name="play" size={10} color={colors.accent} />}
        {star(11)}
        <Text maxFontSizeMultiplier={COMPACT_TEXT} style={nameStyle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {channel.name}
        </Text>
      </View>
    </>
  );

  if (gestures) {
    return (
      <ArrangeableCell
        width={m.channelW}
        height={m.rowH}
        label={label}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onTap={gestures.showArrangeHint}
        onDragStart={(pageY) => gestures.startDrag(channel, pageY)}
        onDragMove={gestures.moveDrag}
        onDragEnd={gestures.endDrag}
        onSwipeActive={gestures.setListLocked}
        onRemove={() => gestures.removeChannel(channel)}
        onMoveBy={(step) => gestures.moveChannelBy(channel, step)}
      >
        {content}
      </ArrangeableCell>
    );
  }
  return (
    <Pressable
      onPress={() => onAdd(channel)}
      style={[styles.channel, { height: m.rowH }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={favourite ? 'Already in your favourites' : 'Adds to favourites'}
    >
      {content}
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
              <Text maxFontSizeMultiplier={COMPACT_TEXT}
                numberOfLines={1}
                style={[styles.title, m.wide && styles.titleWide, onLight && styles.titleOnLight, !onLight && (past || filler) && styles.titlePast]}
              >
                {p.t}
              </Text>
              {p.l ? (
                <Text maxFontSizeMultiplier={COMPACT_TEXT} style={[styles.badge, styles.badgeLive]}>Live</Text>
              ) : p.n ? (
                <Text maxFontSizeMultiplier={COMPACT_TEXT} style={[styles.badge, onLight && styles.titleOnLight]}>New</Text>
              ) : null}
            </View>
            {showMeta && (
              <Text maxFontSizeMultiplier={COMPACT_TEXT} numberOfLines={1} style={[styles.meta, onLight && styles.metaOnLight]}>
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
  dragging: { zIndex: 10, elevation: 8, opacity: 0.92, backgroundColor: colors.surface },
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
