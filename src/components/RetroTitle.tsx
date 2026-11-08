import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';
import type { RegionKey } from '../epg/types';
import { TITLE_ART, TITLE_COLUMNS, TITLE_FRAMES } from './titleArt';

const RIPPLE_MS = 1800;
const useNativeDriver = Platform.OS !== 'web';

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * A country's name in pixel letters cut out of its flag, rippling like a flag in the wind. The ripple
 * is drawn in advance as frames on one sprite sheet, which slides behind a frame-sized window. It
 * only moves on the screen in view, and lies flat when the phone asks for less motion.
 */
export function RetroTitle({ text, region }: { text: string; region: RegionKey }) {
  const art = TITLE_ART[region];
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const clock = useRef(new Animated.Value(0)).current;
  const moving = focused && !reduceMotion && appActive;

  useEffect(() => {
    if (!moving) return;
    const loop = Animated.loop(Animated.timing(clock, { toValue: TITLE_FRAMES, duration: RIPPLE_MS, easing: Easing.linear, useNativeDriver }));
    loop.start();
    return () => {
      loop.stop();
      clock.setValue(0);
    };
  }, [moving, clock]);

  // Jumps from frame to frame rather than sliding between them.
  const position = useMemo(() => {
    const input: number[] = [], xs: number[] = [], ys: number[] = [];
    for (let f = 0; f < TITLE_FRAMES; f++) {
      const x = -(f % TITLE_COLUMNS) * art.pitchX, y = -Math.floor(f / TITLE_COLUMNS) * art.pitchY;
      input.push(f, f + 0.999);
      xs.push(x, x);
      ys.push(y, y);
    }
    input.push(TITLE_FRAMES);
    xs.push(0);
    ys.push(0);
    return {
      translateX: clock.interpolate({ inputRange: input, outputRange: xs }),
      translateY: clock.interpolate({ inputRange: input, outputRange: ys }),
    };
  }, [clock, art.pitchX, art.pitchY]);

  // The cell after the last frame holds the word lying flat.
  const still = { x: -(TITLE_FRAMES % TITLE_COLUMNS) * art.pitchX, y: -Math.floor(TITLE_FRAMES / TITLE_COLUMNS) * art.pitchY };

  return (
    <View style={[styles.window, { width: art.width, height: art.height }]} accessible accessibilityRole="header" accessibilityLabel={text}>
      <Animated.View
        style={{
          width: art.sheetWidth,
          height: art.sheetHeight,
          transform: moving ? [{ translateX: position.translateX }, { translateY: position.translateY }] : [{ translateX: still.x }, { translateY: still.y }],
        }}
      >
        <Image source={art.image} style={{ width: art.sheetWidth, height: art.sheetHeight }} contentFit="fill" accessible={false} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: { marginTop: 6, overflow: 'hidden' },
});
