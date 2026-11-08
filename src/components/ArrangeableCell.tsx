import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { COMPACT_TEXT, colors } from '../theme';

const HOLD_MS = 350;
const SWIPE_START = 10;
// How far a swipe must travel to remove, as a share of the cell's width, unless it was a quick flick.
const SWIPE_REMOVE = 0.4;

type Props = {
  width: number;
  height: number;
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  children: ReactNode;
  onTap: () => void;
  onDragStart: (pageY: number) => void;
  onDragMove: (dy: number, pageY: number) => void;
  onDragEnd: (commit: boolean) => void;
  /** Stops the list scrolling under a sideways swipe. */
  onSwipeActive: (active: boolean) => void;
  onRemove: () => void;
  onMoveBy: (step: number) => void;
};

/** A channel that can be held and dragged to move it, or swiped left to remove it. Tapping changes nothing. */
export function ArrangeableCell(props: Props) {
  const { width, height, label, canMoveUp, canMoveDown, children } = props;
  // The responder lives as long as the cell, so it reads the latest callbacks through this ref.
  const latest = useRef(props);
  latest.current = props;

  const [swiping, setSwiping] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const gesture = useRef({ timer: undefined as ReturnType<typeof setTimeout> | undefined, mode: 'idle' as 'idle' | 'drag' | 'swipe' | 'wandered' }).current;

  const showSwipe = (active: boolean) => {
    setSwiping(active);
    latest.current.onSwipeActive(active);
  };
  const settle = (remove: boolean) => {
    Animated.timing(x, { toValue: remove ? -latest.current.width : 0, duration: 160, useNativeDriver: false }).start(() => {
      showSwipe(false);
      if (remove) latest.current.onRemove();
      x.setValue(0);
    });
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      // Leaves the list free to take over and scroll until a hold or swipe has begun.
      onShouldBlockNativeResponder: () => false,
      onPanResponderTerminationRequest: () => gesture.mode !== 'drag' && gesture.mode !== 'swipe',
      onPanResponderGrant: (_, g) => {
        gesture.mode = 'idle';
        gesture.timer = setTimeout(() => {
          gesture.mode = 'drag';
          latest.current.onDragStart(g.y0);
        }, HOLD_MS);
      },
      onPanResponderMove: (_, g) => {
        if (gesture.mode === 'drag') latest.current.onDragMove(g.dy, g.moveY);
        else if (gesture.mode === 'swipe') x.setValue(Math.min(0, g.dx));
        else if (gesture.mode === 'idle') {
          if (g.dx < -SWIPE_START && Math.abs(g.dx) > Math.abs(g.dy) * 1.5) {
            clearTimeout(gesture.timer);
            gesture.mode = 'swipe';
            showSwipe(true);
          } else if (Math.abs(g.dx) + Math.abs(g.dy) > SWIPE_START) {
            clearTimeout(gesture.timer);
            gesture.mode = 'wandered';
          }
        }
      },
      onPanResponderRelease: (_, g) => {
        clearTimeout(gesture.timer);
        if (gesture.mode === 'drag') latest.current.onDragEnd(true);
        else if (gesture.mode === 'swipe') settle(g.dx < -latest.current.width * SWIPE_REMOVE || (g.vx < -0.6 && g.dx < -30));
        else if (gesture.mode === 'idle') latest.current.onTap();
        gesture.mode = 'idle';
      },
      onPanResponderTerminate: () => {
        clearTimeout(gesture.timer);
        if (gesture.mode === 'drag') latest.current.onDragEnd(false);
        else if (gesture.mode === 'swipe') settle(false);
        gesture.mode = 'idle';
      },
    }),
  ).current;

  const actions = [
    ...(canMoveUp ? [{ name: 'moveUp', label: 'Move up' }] : []),
    ...(canMoveDown ? [{ name: 'moveDown', label: 'Move down' }] : []),
    { name: 'remove', label: 'Remove from favourites' },
  ];

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Hold and drag to move. Swipe left to remove."
      accessibilityActions={actions}
      onAccessibilityAction={(e) => {
        const action = e.nativeEvent.actionName;
        if (action === 'remove') latest.current.onRemove();
        else latest.current.onMoveBy(action === 'moveUp' ? -1 : 1);
      }}
      style={[styles.cell, { width, height }]}
    >
      {swiping && (
        <View style={styles.remove}>
          <Ionicons name="trash-outline" size={18} color={colors.text} />
          <Text maxFontSizeMultiplier={COMPACT_TEXT} style={styles.removeText}>Remove</Text>
        </View>
      )}
      <Animated.View style={[styles.content, { transform: [{ translateX: x }] }]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { overflow: 'hidden', userSelect: 'none' },
  remove: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingRight: 8,
    backgroundColor: colors.live,
  },
  removeText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.background },
});
