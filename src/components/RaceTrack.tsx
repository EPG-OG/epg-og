import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { RegionKey } from '../epg/types';
import { isWebsite } from '../distribution';
import { startMatch } from './footballScene';
import { startRace } from './raceScene';

// Just for fun, in the empty space of the browser version's top bar on big screens: stock cars
// racing round a banked turn on the USA guide (raceScene.ts), a football match on the UK guide
// (footballScene.ts).

// Uses the top bar's padding too, so the bar itself stays the same height.
const HEIGHT = 64;
const PADDING_TOP = 8;

// A moment worth freezing on, for people who'd rather not have motion.
const STILL = { us: 3.6, uk: 9 };

export function RaceTrack({ region }: { region: RegionKey }) {
  const { width: screenW } = useWindowDimensions();
  const boxRef = useRef<ComponentRef<typeof View>>(null);
  const [width, setWidth] = useState(0);
  const show = isWebsite && screenW >= 900;
  // Only the tab on screen animates; the other country's guide stays on the page underneath.
  const focused = useIsFocused();

  useEffect(() => {
    const box = boxRef.current as unknown as HTMLElement | null;
    if (!show || !focused || !box || width < 360) return;
    box.style.maskImage = box.style.webkitMaskImage = 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 60px), transparent)';
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    box.appendChild(canvas);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? STILL[region] : undefined;
    const stop = (region === 'uk' ? startMatch : startRace)(canvas, Math.round(width), HEIGHT, still);
    return () => {
      stop();
      canvas.remove();
    };
  }, [show, focused, width, region]);

  if (!show) return null;
  return (
    <View
      ref={boxRef}
      aria-hidden
      pointerEvents="none"
      style={styles.box}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    />
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, height: HEIGHT, marginTop: -PADDING_TOP, alignSelf: 'flex-end', overflow: 'hidden', minWidth: 0 },
});
