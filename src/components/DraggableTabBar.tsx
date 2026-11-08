import { Tabs } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { usePreferences } from '../preferences/PreferencesContext';
import { COMPACT_TEXT, colors } from '../theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const HOLD_MS = 350;
const ICON_SIZE = 24;

const moved = <T,>(list: T[], from: number, to: number) => {
  const out = [...list];
  out.splice(to, 0, ...out.splice(from, 1));
  return out;
};

/** Bottom tab bar. Tap to switch tabs; hold a tab and drag it to rearrange. */
export function DraggableTabBar({ state, descriptors, emitter, navigateToTab, insets }: TabBarProps) {
  const { loaded, tabOrder, setTabOrder } = usePreferences();
  const [barWidth, setBarWidth] = useState(0);
  const [drag, setDrag] = useState<{ name: string; start: number; dx: number }>();

  const routes = state.routes;
  const savedOrder = useMemo(() => {
    const names = routes.map((r) => r.name);
    return [...tabOrder.filter((n) => names.includes(n)), ...names.filter((n) => !tabOrder.includes(n))];
  }, [routes, tabOrder]);

  const tabWidth = barWidth / savedOrder.length || 1;
  const target = drag ? Math.min(savedOrder.length - 1, Math.max(0, drag.start + Math.round(drag.dx / tabWidth))) : 0;
  const order = drag ? moved(savedOrder, drag.start, target) : savedOrder;

  // Open on whichever tab the user has put first.
  const opened = useRef(false);
  useEffect(() => {
    if (!loaded || opened.current) return;
    opened.current = true;
    const first = routes.find((r) => r.name === savedOrder[0]);
    if (state.index === 0 && first && first.key !== routes[0].key) navigateToTab(first.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
      {order.map((name, slot) => {
        const route = routes.find((r) => r.name === name)!;
        const { options } = descriptors[route.key];
        const focused = routes[state.index].key === route.key;
        const color = focused ? colors.accent : colors.textDim;
        const dragging = drag?.name === name;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? name);
        return (
          <DraggableTab
            key={route.key}
            label={label}
            accessibilityLabel={options.title ?? label}
            focused={focused}
            color={color}
            icon={options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
            badge={options.tabBarBadge}
            offset={dragging && drag ? drag.dx - (target - drag.start) * tabWidth : 0}
            dragging={dragging}
            canMoveLeft={slot > 0}
            canMoveRight={slot < order.length - 1}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onDragStart={() => setDrag({ name, start: savedOrder.indexOf(name), dx: 0 })}
            onDragMove={(dx) => setDrag((d) => (d ? { ...d, dx } : d))}
            onDragEnd={(commit) => {
              if (commit) setTabOrder(order);
              setDrag(undefined);
            }}
            onMoveBy={(step) => setTabOrder(moved(savedOrder, slot, slot + step))}
          />
        );
      })}
    </View>
  );
}

type TabProps = {
  label: string;
  accessibilityLabel: string;
  focused: boolean;
  color: string;
  icon: ReactNode;
  badge?: number | string;
  offset: number;
  dragging: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onPress: () => void;
  onDragStart: () => void;
  onDragMove: (dx: number) => void;
  onDragEnd: (commit: boolean) => void;
  onMoveBy: (step: number) => void;
};

function DraggableTab(props: TabProps) {
  const { label, accessibilityLabel, focused, color, icon, badge, offset, dragging, canMoveLeft, canMoveRight } = props;
  // The responder lives as long as the tab, so it reads the latest callbacks through this ref.
  const latest = useRef(props);
  latest.current = props;

  const gesture = useRef({ timer: undefined as ReturnType<typeof setTimeout> | undefined, active: false, wandered: false }).current;
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => !gesture.active,
      onPanResponderGrant: () => {
        gesture.active = false;
        gesture.wandered = false;
        gesture.timer = setTimeout(() => {
          gesture.active = true;
          latest.current.onDragStart();
        }, HOLD_MS);
      },
      onPanResponderMove: (_, g) => {
        if (gesture.active) latest.current.onDragMove(g.dx);
        else if (Math.abs(g.dx) + Math.abs(g.dy) > 10) {
          gesture.wandered = true;
          clearTimeout(gesture.timer);
        }
      },
      onPanResponderRelease: () => {
        clearTimeout(gesture.timer);
        if (gesture.active) latest.current.onDragEnd(true);
        else if (!gesture.wandered) latest.current.onPress();
        gesture.active = false;
      },
      onPanResponderTerminate: () => {
        clearTimeout(gesture.timer);
        if (gesture.active) latest.current.onDragEnd(false);
        gesture.active = false;
      },
    }),
  ).current;

  const actions = [
    ...(canMoveLeft ? [{ name: 'moveLeft', label: 'Move tab left' }] : []),
    ...(canMoveRight ? [{ name: 'moveRight', label: 'Move tab right' }] : []),
  ];

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: focused }}
      aria-selected={focused}
      accessibilityActions={actions}
      onAccessibilityAction={(e) => latest.current.onMoveBy(e.nativeEvent.actionName === 'moveLeft' ? -1 : 1)}
      onAccessibilityTap={() => latest.current.onPress()}
      style={[styles.tab, dragging && styles.tabDragging, dragging && { transform: [{ translateX: offset }, { scale: 1.08 }] }]}
    >
      <View>
        {icon}
        {badge !== undefined && (
          <View style={styles.badge}>
            <Text maxFontSizeMultiplier={COMPACT_TEXT} style={styles.badgeText} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        )}
      </View>
      <Text maxFontSizeMultiplier={COMPACT_TEXT} style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 8, paddingBottom: 6, userSelect: 'none' },
  tabDragging: { zIndex: 2, backgroundColor: colors.cell, borderRadius: 10 },
  label: { fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -11,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  badgeText: { color: colors.background, fontSize: 11, fontWeight: '700' },
});
