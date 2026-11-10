import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { atLocalHour, formatTime } from '../time';

// The browser version's slider under the guide: grab the handle (or click along the track) to move
// through the day, for people who'd rather not drag the guide itself. Web only: it works directly
// with the page's scrolling element.

type Props = {
  /** The guide's sideways-scrolling element. */
  scroller: () => HTMLElement | null;
  from: number;
  to: number;
  now: number;
  pxPerMin: number;
  /** Width of the channel column, so the track lines up under the shows. */
  inset: number;
};

export const TIME_SLIDER_HEIGHT = 48;
const USED_KEY = 'time-slider-used:v1';
const MIN_THUMB = 128;
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

const hasUsed = () => {
  try {
    return !!localStorage.getItem(USED_KEY);
  } catch {
    return false;
  }
};

export function TimeSlider({ scroller, from, to, now, pxPerMin, inset }: Props) {
  const trackRef = useRef<ComponentRef<typeof View>>(null);
  const [trackW, setTrackW] = useState(0);
  // The guide's scroll position and visible width.
  const [view, setView] = useState({ left: 0, width: 0, total: 1 });
  const [used, setUsed] = useState(hasUsed);

  const latest = useRef({ scroller, trackW, view, pxPerMin });
  latest.current = { scroller, trackW, view, pxPerMin };

  // Follow the guide however it's moved: dragging, the wheel, Now/Tonight/Tomorrow.
  useEffect(() => {
    let node: HTMLElement | null = null;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (node) setView({ left: node.scrollLeft, width: node.clientWidth, total: node.scrollWidth });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    // The guide may not have laid out yet on the first render.
    const attach = setInterval(() => {
      node = latest.current.scroller();
      if (!node) return;
      clearInterval(attach);
      node.addEventListener('scroll', onScroll, { passive: true });
      read();
    }, 100);
    const onResize = () => onScroll();
    window.addEventListener('resize', onResize);
    return () => {
      clearInterval(attach);
      cancelAnimationFrame(frame);
      node?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const maxScroll = Math.max(1, view.total - view.width);
  const thumbW = Math.min(trackW, Math.max(MIN_THUMB, trackW * (view.width / Math.max(view.total, 1))));
  const room = Math.max(1, trackW - thumbW);
  const thumbLeft = Math.min(room, Math.max(0, (view.left / maxScroll) * room));
  // Where on the track the handle's centre sits when time `t` is in the middle of the guide.
  const trackX = (t: number) => {
    const scroll = ((t - from) / 60) * pxPerMin - view.width / 2;
    return (Math.min(maxScroll, Math.max(0, scroll)) / maxScroll) * room + thumbW / 2;
  };
  const middle = from + ((view.left + view.width / 2) / pxPerMin) * 60;
  const label = `${weekday.format(new Date(middle * 1000))} ${formatTime(middle - (middle % 300))}`;

  const midnights: number[] = [];
  for (let d = 1, t = atLocalHour(from, 1, 0); t < to; t = atLocalHour(from, ++d, 0)) midnights.push(t);

  // Pointer and keyboard handling, straight on the page element.
  useEffect(() => {
    const track = trackRef.current as unknown as HTMLElement | null;
    if (!track) return;
    track.setAttribute('data-time-slider', '');
    track.setAttribute('role', 'slider');
    track.setAttribute('tabindex', '0');
    track.setAttribute('aria-label', 'Time in the guide. Slide to move through the day.');

    let grab: { id: number; offset: number } | undefined;
    const markUsed = () => {
      setUsed(true);
      try {
        localStorage.setItem(USED_KEY, '1');
      } catch {}
    };
    // Moves the guide so the handle's left edge is at `x` pixels along the track.
    const moveTo = (x: number) => {
      const { scroller: get, trackW: w, view: v } = latest.current;
      const node = get();
      if (!node) return;
      const thumb = Math.min(w, Math.max(MIN_THUMB, w * (v.width / Math.max(v.total, 1))));
      const space = Math.max(1, w - thumb);
      node.scrollLeft = (Math.min(space, Math.max(0, x)) / space) * Math.max(0, node.scrollWidth - node.clientWidth);
    };
    const thumbBox = () => {
      const { trackW: w, view: v } = latest.current;
      const thumb = Math.min(w, Math.max(MIN_THUMB, w * (v.width / Math.max(v.total, 1))));
      const space = Math.max(1, w - thumb);
      const max = Math.max(1, v.total - v.width);
      return { left: Math.min(space, Math.max(0, (v.left / max) * space)), width: thumb };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      track.focus();
      const x = e.clientX - track.getBoundingClientRect().left;
      const box = thumbBox();
      // Grabbing the handle keeps it under the pointer; clicking the track jumps the handle there.
      const offset = x >= box.left && x <= box.left + box.width ? x - box.left : box.width / 2;
      grab = { id: e.pointerId, offset };
      track.setPointerCapture(e.pointerId);
      moveTo(x - offset);
      markUsed();
    };
    const onMove = (e: PointerEvent) => {
      if (!grab || e.pointerId !== grab.id) return;
      moveTo(e.clientX - track.getBoundingClientRect().left - grab.offset);
    };
    const onUp = (e: PointerEvent) => {
      if (!grab || e.pointerId !== grab.id) return;
      grab = undefined;
      if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
    };
    const onKey = (e: KeyboardEvent) => {
      const step = { ArrowLeft: -30, ArrowRight: 30, PageUp: -180, PageDown: 180 }[e.key];
      const node = latest.current.scroller();
      if (!step || !node) return;
      e.preventDefault();
      node.scrollBy({ left: step * latest.current.pxPerMin, behavior: 'smooth' });
      markUsed();
    };

    track.addEventListener('pointerdown', onDown);
    track.addEventListener('pointermove', onMove);
    track.addEventListener('pointerup', onUp);
    track.addEventListener('pointercancel', onUp);
    track.addEventListener('keydown', onKey);
    return () => {
      track.removeEventListener('pointerdown', onDown);
      track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointerup', onUp);
      track.removeEventListener('pointercancel', onUp);
      track.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    (trackRef.current as unknown as HTMLElement | null)?.setAttribute('aria-valuetext', label);
  }, [label]);

  // The arrows nudge outwards until the slider has been used once, to show it slides.
  const nudge = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (used) {
      nudge.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(nudge, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.delay(250),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [used, nudge]);
  const outLeft = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const outRight = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });

  return (
    <View style={styles.bar}>
      <View style={[styles.hint, { width: inset }]}>
        <Ionicons name="time-outline" size={15} color={colors.textDim} />
        <Text style={styles.hintText} numberOfLines={2}>
          Slide through time
        </Text>
      </View>
      <View ref={trackRef} style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        <View style={styles.rail} />
        {trackW > 0 &&
          midnights.map((t) => (
            <View key={t} pointerEvents="none" style={[styles.day, { left: trackX(t) }]}>
              <View style={styles.dayTick} />
              <Text style={styles.dayText}>{weekday.format(new Date(t * 1000))}</Text>
            </View>
          ))}
        {trackW > 0 && now > from && now < to && <View pointerEvents="none" style={[styles.nowDot, { left: trackX(now) - 4 }]} />}
        {trackW > 0 && (
          <View style={[styles.thumb, { left: thumbLeft, width: thumbW }]}>
            <Animated.View style={{ transform: [{ translateX: outLeft }] }}>
              <Ionicons name="chevron-back" size={16} color={colors.accent} />
            </Animated.View>
            <Text style={styles.thumbText} numberOfLines={1}>
              {label}
            </Text>
            <Animated.View style={{ transform: [{ translateX: outRight }] }}>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </Animated.View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: TIME_SLIDER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  hintText: { flex: 1, color: colors.textDim, fontSize: 12, fontWeight: '600' },
  track: { flex: 1, alignSelf: 'stretch', marginRight: 12, justifyContent: 'center', cursor: 'pointer', outlineStyle: 'none' } as object,
  rail: { height: 6, borderRadius: 3, backgroundColor: colors.cell },
  day: { position: 'absolute', top: 6, bottom: 6, flexDirection: 'row', alignItems: 'flex-start' },
  dayTick: { width: 2, alignSelf: 'stretch', backgroundColor: colors.divider },
  dayText: { color: colors.textDim, fontSize: 10, fontWeight: '700', marginLeft: 4 },
  nowDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    cursor: 'grab',
  } as object,
  thumbText: { flexShrink: 1, color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center', userSelect: 'none' } as object,
});
