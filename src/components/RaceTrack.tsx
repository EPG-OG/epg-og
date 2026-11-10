import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { RegionKey } from '../epg/types';
import { isWebsite } from '../distribution';
import { startMatch } from './footballScene';
import { startRace, type SceneHandle } from './raceScene';

// Just for fun, in the empty space of the browser version's top bar on big screens: stock cars
// racing round a banked turn on the USA guide (raceScene.ts), a football match on the UK guide
// (footballScene.ts). Clicking it pauses or plays it, remembered for next time.

// Uses the top bar's padding too, so the bar itself stays the same height.
const HEIGHT = 64;
const PADDING_TOP = 8;
const PAUSED_KEY = 'top-bar-animation-paused:v1';

// A moment worth freezing on, while paused or for people who'd rather not have motion.
const STILL = { us: 3.6, uk: 9 };

const PLAY_ICON = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 2.5h3v11H4zm5 0h3v11H9z" fill="currentColor"/></svg>';

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
    box.style.cursor = 'pointer';
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.setAttribute('aria-hidden', 'true');
    box.appendChild(canvas);

    // The pause/play button: shown on hover or keyboard focus, and always while paused.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'epg-scene-toggle';
    // Keyboard focus always shows the button, even when the page itself isn't hovered.
    if (!document.getElementById('epg-scene-toggle-style')) {
      const style = document.createElement('style');
      style.id = 'epg-scene-toggle-style';
      style.textContent = '.epg-scene-toggle:focus-visible { opacity: 1 !important; outline: 2px solid #3ea4f0; outline-offset: 1px; }';
      document.head.appendChild(style);
    }
    Object.assign(button.style, {
      position: 'absolute', right: '66px', bottom: '6px', width: '24px', height: '24px', borderRadius: '12px', border: '0', padding: '0',
      display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(12,14,18,.78)', color: '#f2f3f5', cursor: 'pointer',
      opacity: '0', transition: 'opacity .2s',
    });
    box.appendChild(button);

    const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let stored = false;
    try {
      stored = localStorage.getItem(PAUSED_KEY) === '1';
    } catch {}
    let paused = stored || reducedMotion;
    const start = region === 'uk' ? startMatch : startRace;
    const size = Math.round(width);
    // Paused from the start: show a still moment, and only start moving when asked to.
    let scene: SceneHandle = start(canvas, size, HEIGHT, paused ? STILL[region] : undefined);
    let moving = !paused;
    let hovering = false;

    const refresh = () => {
      button.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
      const label = paused ? 'Play the animation' : 'Pause the animation';
      button.setAttribute('aria-label', label);
      button.title = label;
      button.style.opacity = paused || hovering || document.activeElement === button ? '1' : '0';
    };
    const toggle = () => {
      paused = !paused;
      try {
        localStorage.setItem(PAUSED_KEY, paused ? '1' : '0');
      } catch {}
      if (!paused && !moving) {
        scene();
        scene = start(canvas, size, HEIGHT);
        moving = true;
      } else {
        scene.setPaused(paused);
      }
      refresh();
    };
    const onEnter = () => {
      hovering = true;
      refresh();
    };
    const onLeave = () => {
      hovering = false;
      refresh();
    };
    box.addEventListener('click', toggle);
    box.addEventListener('mouseenter', onEnter);
    box.addEventListener('mouseleave', onLeave);
    button.addEventListener('focus', refresh);
    button.addEventListener('blur', refresh);
    refresh();

    return () => {
      scene();
      box.removeEventListener('click', toggle);
      box.removeEventListener('mouseenter', onEnter);
      box.removeEventListener('mouseleave', onLeave);
      canvas.remove();
      button.remove();
    };
  }, [show, focused, width, region]);

  if (!show) return null;
  return <View ref={boxRef} style={styles.box} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} />;
}

const styles = StyleSheet.create({
  box: { flex: 1, height: HEIGHT, marginTop: -PADDING_TOP, alignSelf: 'flex-end', overflow: 'hidden', minWidth: 0 },
});
