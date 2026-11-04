import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PreferencesProvider } from '../preferences/PreferencesContext';
import { colors } from '../theme';
import { WatchlistProvider } from '../watchlist/WatchlistContext';

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <WatchlistProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="watchlist" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </WatchlistProvider>
    </PreferencesProvider>
  );
}
