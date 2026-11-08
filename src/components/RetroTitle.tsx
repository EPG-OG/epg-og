import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';
import type { RegionKey } from '../epg/types';
import { TITLE_ART } from './titleArt';

const HOP_MS = 170;
const STAGGER_MS = 120;
const REST_MS = 3200;
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
 * A country's name in pixel letters cut out of its flag. Every few seconds a wave hops through the
 * letters like an old arcade title screen, but only on the screen in view, and never when the phone
 * asks for less motion.
 */
export function RetroTitle({ text, region }: { text: string; region: RegionKey }) {
  const art = TITLE_ART[region];
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const lifts = useRef(art.letters.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!focused || reduceMotion || !appActive) return;
    const hop = (v: Animated.Value) =>
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: HOP_MS, easing: Easing.linear, useNativeDriver }),
        Animated.timing(v, { toValue: 0, duration: HOP_MS, easing: Easing.linear, useNativeDriver }),
      ]);
    const loop = Animated.loop(Animated.sequence([Animated.delay(600), Animated.stagger(STAGGER_MS, lifts.map(hop)), Animated.delay(REST_MS)]));
    loop.start();
    return () => {
      loop.stop();
      lifts.forEach((v) => v.setValue(0));
    };
  }, [focused, reduceMotion, appActive, lifts]);

  return (
    <View
      style={[styles.word, { width: art.width, height: art.height }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={text}
    >
      {art.letters.map((letter, i) => {
        // Moves in whole steps rather than smoothly, like 8-bit sprites.
        const translateY = lifts[i].interpolate({ inputRange: [0, 0.34, 0.35, 0.67, 0.68, 1], outputRange: [0, 0, -4, -4, -8, -8] });
        return (
          <Animated.View key={i} style={[styles.letter, { left: letter.left, transform: [{ translateY }] }]}>
            <Image source={letter.image} style={{ width: letter.width, height: letter.height }} contentFit="contain" accessible={false} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  word: { marginTop: 8 },
  letter: { position: 'absolute', top: 0 },
});
