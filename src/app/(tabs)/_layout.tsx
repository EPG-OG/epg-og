import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import { showTipJar } from '../../distribution';
import { colors } from '../../theme';
import { useWatchlist } from '../../watchlist/WatchlistContext';

// Text badges instead of flag emoji, which render as plain letters on some Android/Windows fonts.
function RegionIcon({ code, color }: { code: string; color: ColorValue }) {
  return (
    <View style={[styles.region, { borderColor: color }]}>
      <Text style={[styles.regionText, { color }]}>{code}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { items } = useWatchlist();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'USA', tabBarIcon: ({ color }) => <RegionIcon code="US" color={color} /> }} />
      <Tabs.Screen name="uk" options={{ title: 'UK', tabBarIcon: ({ color }) => <RegionIcon code="UK" color={color} /> }} />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" size={size} color={color as string} />,
          tabBarBadge: items.length || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.background, fontWeight: '700' },
        }}
      />
      <Tabs.Screen
        name="coffee"
        options={{
          title: showTipJar ? 'Buy Me a Coffee' : 'About',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={showTipJar ? 'cafe' : 'information-circle'} size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  region: { borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 3, minWidth: 26, alignItems: 'center' },
  regionText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});
