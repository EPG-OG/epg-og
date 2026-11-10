import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { isWebsite } from '../distribution';
import { startRace } from './raceScene';

// Just for fun: stock cars racing round a banked turn in the empty space of the browser version's
// top bar on big screens. The scene itself is drawn in raceScene.ts.

// Uses the top bar's padding too, so the bar itself stays the same height.
const HEIGHT = 64;
const PADDING_TOP = 8;

export function RaceTrack() {
  const { width: screenW } = useWindowDimensions();
  const boxRef = useRef<ComponentRef<typeof View>>(null);
  const [width, setWidth] = useState(0);
  const show = isWebsite && screenW >= 900;

  useEffect(() => {
    const box = boxRef.current as unknown as HTMLElement | null;
    if (!show || !box || width < 360) return;
    box.style.maskImage = box.style.webkitMaskImage = 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 60px), transparent)';
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    box.appendChild(canvas);
    // Still cars for people who'd rather not have motion.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 3.6 : undefined;
    const stop = startRace(canvas, Math.round(width), HEIGHT, still);
    return () => {
      stop();
      canvas.remove();
    };
  }, [show, width]);

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
