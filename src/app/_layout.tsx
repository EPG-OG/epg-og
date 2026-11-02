import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';
import { WatchlistProvider } from '../watchlist/WatchlistContext';

export default function RootLayout() {
  return (
    <WatchlistProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </WatchlistProvider>
  );
}
