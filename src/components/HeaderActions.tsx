import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { useWatchlist } from '../watchlist/WatchlistContext';

/** Watchlist and search buttons at the top of each guide. */
export function HeaderActions() {
  const { items } = useWatchlist();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push('/watchlist')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Watchlist, ${items.length} ${items.length === 1 ? 'show' : 'shows'}`}
      >
        <Ionicons name="bookmark-outline" size={24} color={colors.text} />
        {items.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {items.length}
            </Text>
          </View>
        )}
      </Pressable>
      <Pressable onPress={() => router.push('/search')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Search shows and channels">
        <Ionicons name="search" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -9,
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
