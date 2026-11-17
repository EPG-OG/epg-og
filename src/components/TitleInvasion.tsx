import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { RegionKey } from '../epg/types';
import { COMPACT_TEXT } from '../theme';
import { TITLE_ART, TITLE_COLUMNS, TITLE_FRAMES } from './titleArt';

// A rare surprise on phones: flying saucers drop in over the top of the screen and zap the guide's
// title apart, Space Invaders style, leaving a few jagged pieces standing. Then a flight of fighter
// jets streaks in from the top right, shoots the saucers down, and the title rebuilds behind the
// last jet. The title is cut into small squares that are real pieces of it, so it's those pieces
// that tumble away. Everything is driven by one clock on the UI thread.

export type Box = { x: number; y: number; w: number; h: number };

const useNativeDriver = Platform.OS !== 'web';
const PIECE = 6; // size of the squares the title breaks into, points
const ARRIVE = 1.0; // saucers in place
const ATTACK_FROM = 1.3;
const ATTACK_TO = 4.1;
const JETS_FROM = 4.7;
const JET_GAP = 0.28;
const JET_TIME = 1.7;
const KEEP_AT_LEAST = 0.28; // share of the title left standing
const TOTAL = JETS_FROM + 2 * JET_GAP + JET_TIME + 0.6;

type Piece = { kind: 'art' | 'text'; x: number; y: number; w: number; h: number; sx: number; sy: number; hit?: number; vx: number; vy: number; spin: number; back: number };
type Hit = { t: number; ufo: number; x: number; y: number };
type Ufo = { x: number; y: number; enter: number; dies: number };
type Jet = { start: number; x0: number; y0: number; x1: number; y1: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function plan(title: Box, subtitle: Box | null, top: number, width: number, height: number) {
  const pieces: Piece[] = [];
  const cut = (kind: Piece['kind'], box: Box) => {
    for (let sy = 0; sy < box.h; sy += PIECE)
      for (let sx = 0; sx < box.w; sx += PIECE)
        pieces.push({ kind, x: box.x + sx, y: top + box.y + sy, w: Math.min(PIECE, box.w - sx), h: Math.min(PIECE, box.h - sy), sx, sy, vx: 0, vy: 0, spin: 0, back: 0 });
  };
  cut('art', title);
  if (subtitle) cut('text', subtitle);

  // Three saucers spread over the title and "TV Guide", hovering just above them.
  const left = title.x;
  const right = subtitle ? subtitle.x + subtitle.w : title.x + title.w;
  const span = right - left;
  const ufos: Ufo[] = [0.18, 0.55, 0.9].map((k, i) => ({ x: left + span * k, y: top + Math.max(title.y - 4, 2), enter: i * 0.18, dies: 0 }));

  // The attack: laser hits that each blast out a jagged chunk round where they land.
  const hits: Hit[] = [];
  let lost = 0;
  const shots = 11;
  for (let i = 0; i < shots && lost < pieces.length * (1 - KEEP_AT_LEAST); i++) {
    const standing = pieces.filter((p) => p.hit === undefined);
    if (!standing.length) break;
    const target = standing[Math.floor(Math.random() * standing.length)];
    const x = target.x + target.w / 2 + rand(-2, 2);
    const y = target.y + target.h / 2 + rand(-2, 2);
    const t = ATTACK_FROM + ((ATTACK_TO - ATTACK_FROM) * i) / shots + rand(0, 0.12);
    const ufo = ufos.reduce((best, u, k) => (Math.abs(u.x - x) < Math.abs(ufos[best].x - x) ? k : best), 0);
    hits.push({ t, ufo, x, y });
    const radius = rand(7, 11);
    for (const p of standing) {
      const d = Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y);
      if (d > radius || Math.random() > 1 - (d / radius) * 0.55) continue;
      if (lost >= pieces.length * (1 - KEEP_AT_LEAST)) break;
      p.hit = t + d * 0.004;
      const away = Math.atan2(p.y - y, p.x - x);
      p.vx = Math.cos(away) * rand(30, 70) + rand(-20, 20);
      p.vy = -rand(50, 100);
      p.spin = rand(-600, 600);
      lost++;
    }
  }

  // The jets come in from the top right in a line, each shooting down a saucer.
  const jets: Jet[] = [0, 1, 2].map((i) => ({ start: JETS_FROM + i * JET_GAP, x0: width + 50, y0: top - 26 + i * 9, x1: -90, y1: top + height * 0.85 + i * 9 }));
  const jetAt = (jet: Jet, t: number) => {
    const k = (t - jet.start) / JET_TIME;
    return { x: jet.x0 + (jet.x1 - jet.x0) * k, y: jet.y0 + (jet.y1 - jet.y0) * k };
  };
  const shotsAtUfos = ufos.map((u, i) => {
    const jet = jets[i];
    const fire = jet.start + 0.42;
    u.dies = fire + 0.18;
    return { from: jetAt(jet, fire), to: { x: u.x, y: u.y }, fire };
  });

  // The title rebuilds behind the last jet as it sweeps across.
  const last = jets[jets.length - 1];
  const lastDeath = Math.max(...ufos.map((u) => u.dies));
  for (const p of pieces) {
    if (p.hit === undefined) continue;
    const k = (p.x + p.w / 2 - last.x0) / (last.x1 - last.x0);
    p.back = Math.max(lastDeath + 0.2, p.hit + 1.4, last.start + JET_TIME * k + 0.05);
  }
  return { pieces, hits, ufos, jets, shotsAtUfos };
}

export function TitleInvasion({ region, title, subtitle, subtitleStyle, top, width, height, onDone }: {
  region: RegionKey;
  title: Box;
  subtitle: Box | null;
  subtitleStyle: TextStyle;
  /** How far the overlay reaches up above the title bar, into the status bar area. */
  top: number;
  width: number;
  height: number;
  onDone: () => void;
}) {
  const clock = useRef(new Animated.Value(0)).current;
  const scene = useMemo(() => plan(title, subtitle, top, width, height), [title, subtitle, top, width, height]);
  const art = TITLE_ART[region];
  const still = { x: -(TITLE_FRAMES % TITLE_COLUMNS) * art.pitchX, y: -Math.floor(TITLE_FRAMES / TITLE_COLUMNS) * art.pitchY };

  useEffect(() => {
    const run = Animated.timing(clock, { toValue: TOTAL, duration: TOTAL * 1000, easing: Easing.linear, useNativeDriver });
    run.start(() => onDone());
    return () => run.stop();
  }, [clock, onDone]);

  const at = (inputRange: number[], outputRange: number[]) => clock.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });

  return (
    <View pointerEvents="none" style={[styles.overlay, { top: -top, height: height + top }]}>
      {/* The title in pieces. */}
      {scene.pieces.map((p, i) => {
        const inside =
          p.kind === 'art' ? (
            <Image source={art.image} style={{ position: 'absolute', left: still.x - p.sx, top: still.y - p.sy, width: art.sheetWidth, height: art.sheetHeight }} contentFit="fill" />
          ) : (
            // A full-width holder, so the words aren't squeezed into the little square.
            <View style={{ position: 'absolute', left: -p.sx, top: -p.sy, width: (subtitle?.w ?? 0) + 2, height: subtitle?.h }}>
              <Text maxFontSizeMultiplier={COMPACT_TEXT} style={[subtitleStyle, { marginBottom: 0 }]}>
                TV Guide
              </Text>
            </View>
          );
        if (p.hit === undefined) return <View key={i} style={[styles.piece, { left: p.x, top: p.y, width: p.w, height: p.h }]}>{inside}</View>;
        // Blasted away with a tumble and falling, then back as the last jet passes.
        const h = p.hit;
        const fall = (s: number) => p.vy * s + 0.5 * 260 * s * s;
        const times = [h, h + 0.3, h + 0.6, h + 0.9, h + 1.2, p.back - 0.001, p.back, p.back + 0.35];
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left: p.x,
                top: p.y,
                width: p.w,
                height: p.h,
                opacity: at(times, [1, 1, 1, 0.6, 0, 0, 0, 1]),
                transform: [
                  { translateX: at(times, [0, p.vx * 0.3, p.vx * 0.6, p.vx * 0.9, p.vx * 1.2, p.vx * 1.2, 0, 0]) },
                  { translateY: at(times, [0, fall(0.3), fall(0.6), fall(0.9), fall(1.2), fall(1.2), 0, 0]) },
                  { rotate: at(times, [0, p.spin * 0.3, p.spin * 0.6, p.spin * 0.9, p.spin * 1.2, p.spin * 1.2, 0, 0]).interpolate({ inputRange: [-1000, 1000], outputRange: ['-1000deg', '1000deg'] }) },
                  { scale: at(times, [1, 1, 1, 1, 1, 1, 1.8, 1]) },
                ],
              },
            ]}
          >
            {inside}
          </Animated.View>
        );
      })}

      {/* Laser beams and the flash where each one lands. */}
      {scene.hits.map((hit, i) => {
        const u = scene.ufos[hit.ufo];
        const fromY = u.y + 6;
        const len = Math.hypot(hit.x - u.x, hit.y - fromY);
        const angle = Math.atan2(hit.y - fromY, hit.x - u.x) - Math.PI / 2;
        return (
          <View key={`hit${i}`}>
            <Animated.View
              style={[
                styles.beam,
                {
                  left: (u.x + hit.x) / 2 - 1,
                  top: (fromY + hit.y) / 2 - len / 2,
                  height: len,
                  opacity: at([hit.t - 0.13, hit.t - 0.11, hit.t + 0.05, hit.t + 0.09], [0, 1, 1, 0]),
                  transform: [{ rotate: `${angle}rad` }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.flash,
                {
                  left: hit.x - 7,
                  top: hit.y - 7,
                  opacity: at([hit.t - 0.01, hit.t, hit.t + 0.28], [0, 1, 0]),
                  transform: [{ scale: at([hit.t, hit.t + 0.28], [0.4, 1.7]) }],
                },
              ]}
            />
          </View>
        );
      })}

      {/* The saucers: drop in from above the screen, wobble while they attack, then blow up. */}
      {scene.ufos.map((u, i) => {
        const wobbleTimes = [ARRIVE, ARRIVE + 0.7, ARRIVE + 1.4, ARRIVE + 2.1, ARRIVE + 2.8, ARRIVE + 3.5, ARRIVE + 4.2];
        const blink = at([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75, 6], Array.from({ length: 25 }, (_, k) => (k + i) % 2 ? 1 : 0.35));
        return (
          <View key={`ufo${i}`}>
            <Animated.View
              style={[
                styles.ufo,
                {
                  left: u.x - 15,
                  top: u.y - 8,
                  opacity: at([u.dies - 0.01, u.dies], [1, 0]),
                  transform: [
                    { translateY: at([u.enter, u.enter + ARRIVE], [-u.y - 30, 0]) },
                    { translateX: at(wobbleTimes, [0, 3, -2, 3, -3, 2, 0]) },
                  ],
                },
              ]}
            >
              <View style={styles.ufoDome} />
              <View style={styles.ufoBody}>
                {[0, 1, 2, 3].map((k) => (
                  <Animated.View key={k} style={[styles.ufoLight, { left: 3 + k * 6.5, opacity: k % 2 ? blink : Animated.subtract(1.35, blink) }]} />
                ))}
              </View>
            </Animated.View>
            {/* Blown up: a fireball and bits of saucer flying off. */}
            <Animated.View
              style={[styles.boom, { left: u.x - 14, top: u.y - 14, opacity: at([u.dies, u.dies + 0.05, u.dies + 0.5], [0, 1, 0]), transform: [{ scale: at([u.dies, u.dies + 0.5], [0.3, 1.8]) }] }]}
            />
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const a = (k / 6) * Math.PI * 2 + i;
              return (
                <Animated.View
                  key={k}
                  style={[
                    styles.bit,
                    {
                      left: u.x - 1.5,
                      top: u.y - 1.5,
                      opacity: at([u.dies, u.dies + 0.05, u.dies + 0.7], [0, 1, 0]),
                      transform: [
                        { translateX: at([u.dies, u.dies + 0.7], [0, Math.cos(a) * 26]) },
                        { translateY: at([u.dies, u.dies + 0.35, u.dies + 0.7], [0, Math.sin(a) * 14 - 4, Math.sin(a) * 18 + 10]) },
                      ],
                    },
                  ]}
                />
              );
            })}
          </View>
        );
      })}

      {/* The jets' shots at the saucers. */}
      {scene.shotsAtUfos.map((s, i) => (
        <Animated.View
          key={`shot${i}`}
          style={[
            styles.shot,
            {
              left: s.from.x,
              top: s.from.y,
              opacity: at([s.fire - 0.01, s.fire, s.fire + 0.18, s.fire + 0.19], [0, 1, 1, 0]),
              transform: [
                { translateX: at([s.fire, s.fire + 0.18], [0, s.to.x - s.from.x]) },
                { translateY: at([s.fire, s.fire + 0.18], [0, s.to.y - s.from.y]) },
                { rotate: `${Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x)}rad` },
              ],
            },
          ]}
        />
      ))}

      {/* The jets, diving across from the top right. */}
      {scene.jets.map((jet, i) => {
        const angle = Math.atan2(jet.y1 - jet.y0, jet.x1 - jet.x0);
        return (
          <Animated.View
            key={`jet${i}`}
            style={[
              styles.jet,
              {
                left: jet.x0 - JET_W / 2,
                top: jet.y0 - JET_H / 2,
                transform: [
                  { translateX: at([jet.start, jet.start + JET_TIME], [0, jet.x1 - jet.x0]) },
                  { translateY: at([jet.start, jet.start + JET_TIME], [0, jet.y1 - jet.y0]) },
                  { rotate: `${angle}rad` },
                ],
              },
            ]}
          >
            <Fighter flame={at([jet.start, jet.start + 0.1, jet.start + 0.2, jet.start + 0.3, jet.start + 0.4, jet.start + 0.5, jet.start + 0.6, jet.start + 0.7, jet.start + 0.8, jet.start + 0.9, jet.start + 1, jet.start + 1.1, jet.start + 1.2, jet.start + 1.3, jet.start + 1.4, jet.start + 1.5, jet.start + 1.6, jet.start + 1.7], Array.from({ length: 18 }, (_, k) => (k % 2 ? 0.55 : 1)))} />
          </Animated.View>
        );
      })}
    </View>
  );
}

// A modern stealth fighter seen from above, nose pointing right (assets/invasion/jet.png, drawn
// by scripts/make-jet.mjs), with its afterburner flickering behind it.
const JET_IMAGE = require('../../assets/invasion/jet.png');
const JET_W = 40;
const JET_H = 20;
function Fighter({ flame }: { flame: Animated.AnimatedInterpolation<number> }) {
  return (
    <View style={styles.fighter}>
      <Animated.View style={[styles.afterburner, { opacity: flame }]} />
      <Image source={JET_IMAGE} style={{ width: JET_W, height: JET_H }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  piece: { position: 'absolute', overflow: 'hidden' },
  beam: { position: 'absolute', width: 2, borderRadius: 1, backgroundColor: '#ffe14a', boxShadow: '0 0 4px 1px rgba(255,214,60,.8)' },
  flash: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,170,60,.9)' },
  ufo: { position: 'absolute', width: 30, height: 16 },
  ufoDome: { position: 'absolute', left: 9, top: 0, width: 12, height: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: 'rgba(150,230,255,.85)' },
  ufoBody: { position: 'absolute', left: 0, top: 6, width: 30, height: 8, borderRadius: 4, backgroundColor: '#6d7480', borderBottomWidth: 2, borderBottomColor: '#3c4048' },
  ufoLight: { position: 'absolute', top: 2.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#ffd84a' },
  boom: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,140,40,.85)', borderWidth: 3, borderColor: 'rgba(255,230,120,.9)' },
  bit: { position: 'absolute', width: 3, height: 3, backgroundColor: '#8a909a' },
  shot: { position: 'absolute', width: 10, height: 2, borderRadius: 1, backgroundColor: '#fff1b8', boxShadow: '0 0 3px 1px rgba(255,200,90,.9)' },
  jet: { position: 'absolute', width: JET_W, height: JET_H },
  fighter: { width: JET_W, height: JET_H },
  afterburner: { position: 'absolute', left: -5, top: JET_H / 2 - 1.5, width: 8, height: 3, borderRadius: 1.5, backgroundColor: '#ff9a3c', boxShadow: '0 0 5px 2px rgba(255,140,40,.9)' },
});

// How rare: one roll per app session, the first time a guide is on screen.
const CHANCE = 1 / 12;
let rolled = false;

/** Now and then (and only on phones, with motion allowed), starts the invasion a little after the guide opens. */
export function useRareInvasion(enabled: boolean, start: () => void) {
  const latest = useRef(start);
  latest.current = start;
  useEffect(() => {
    if (!enabled || rolled) return;
    rolled = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce || cancelled || Math.random() > CHANCE) return;
        timer = setTimeout(() => latest.current(), rand(6000, 18000));
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled]);
}
