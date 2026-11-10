import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// In the browser version, lets a mouse grab the guide and drag it in any direction, like a finger
// on a phone, and fling it to keep it gliding. Touchscreens keep the browser's own scrolling, and
// the phone app is unaffected.

type Nodes = { box: HTMLElement | null; horizontal: HTMLElement | null; vertical: HTMLElement | null };

type Options = {
  /** The area to grab, and the two scrolling elements it moves. */
  nodes: () => Nodes;
  /** Leave a press alone, for example one that starts reordering a channel. */
  ignore?: (e: PointerEvent) => boolean;
};

/** How far the mouse moves before a press becomes a drag, so a slightly shaky click still opens a show. */
const DRAG_START = 6;
const FRICTION = 0.95;

const DRAGGING_CLASS = 'epg-mouse-dragging';
function addDraggingStyle() {
  if (document.getElementById(DRAGGING_CLASS)) return;
  const style = document.createElement('style');
  style.id = DRAGGING_CLASS;
  style.textContent = `.${DRAGGING_CLASS}, .${DRAGGING_CLASS} * { cursor: grabbing !important; user-select: none !important; }`;
  document.head.appendChild(style);
}

export function useMouseDragScroll({ nodes, ignore }: Options) {
  // The latest callbacks, so the listeners are only added once.
  const latest = useRef({ nodes, ignore });
  latest.current = { nodes, ignore };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const { box } = latest.current.nodes();
    if (!box) return;
    addDraggingStyle();

    let press: { id: number; x: number; y: number; left: number; top: number; dragging: boolean } | undefined;
    let samples: { x: number; y: number; t: number }[] = [];
    let glide = 0;

    const stopGlide = () => cancelAnimationFrame(glide);
    const scrollTo = (left: number, top: number) => {
      const { horizontal, vertical } = latest.current.nodes();
      if (horizontal) horizontal.scrollLeft = left;
      if (vertical) vertical.scrollTop = top;
    };

    const onDown = (e: PointerEvent) => {
      stopGlide();
      if (e.pointerType !== 'mouse' || e.button !== 0 || latest.current.ignore?.(e)) return;
      const { horizontal, vertical } = latest.current.nodes();
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, left: horizontal?.scrollLeft ?? 0, top: vertical?.scrollTop ?? 0, dragging: false };
      samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    const onMove = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (!press.dragging) {
        if (Math.hypot(dx, dy) < DRAG_START) return;
        press.dragging = true;
        document.documentElement.classList.add(DRAGGING_CLASS);
        window.getSelection()?.removeAllRanges();
      }
      scrollTo(press.left - dx, press.top - dy);
      samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
    };

    const onUp = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const wasDragging = press.dragging;
      press = undefined;
      if (!wasDragging) return;
      document.documentElement.classList.remove(DRAGGING_CLASS);

      // The click that follows letting go would open whatever show is under the mouse.
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener('click', swallow, true);
      setTimeout(() => window.removeEventListener('click', swallow, true), 0);

      // Keep gliding at the speed it was let go, slowing down.
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.t - first.t;
      if (e.type === 'pointercancel' || dt <= 0 || e.timeStamp - last.t > 80) return;
      let vx = (first.x - last.x) / dt;
      let vy = (first.y - last.y) / dt;
      let before = performance.now();
      const step = (now: number) => {
        const { horizontal, vertical } = latest.current.nodes();
        const ms = Math.min(now - before, 50);
        before = now;
        const left = (horizontal?.scrollLeft ?? 0) + vx * ms;
        const top = (vertical?.scrollTop ?? 0) + vy * ms;
        scrollTo(left, top);
        const decay = Math.pow(FRICTION, ms / 16);
        vx *= decay;
        vy *= decay;
        if (Math.abs(vx) > 0.02 || Math.abs(vy) > 0.02) glide = requestAnimationFrame(step);
      };
      if (Math.abs(vx) > 0.2 || Math.abs(vy) > 0.2) glide = requestAnimationFrame(step);
    };

    // Dragging a logo or artwork image would start the browser's own image drag instead.
    const noImageDrag = (e: DragEvent) => e.preventDefault();

    box.addEventListener('pointerdown', onDown);
    box.addEventListener('dragstart', noImageDrag);
    box.addEventListener('wheel', stopGlide, { passive: true });
    box.style.cursor = 'grab';
    return () => {
      stopGlide();
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('dragstart', noImageDrag);
      box.removeEventListener('wheel', stopGlide);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.classList.remove(DRAGGING_CLASS);
    };
  }, []);
}

