import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { EPG_BASE_URL } from '../config';
import { showUpdateBanner } from '../distribution';
import { colors } from '../theme';

type LatestRelease = { version: string; apkUrl: string; notesUrl?: string };

const DISMISSED_KEY = 'update-banner:dismissed';

/** True if version a (e.g. "1.2.0") is newer than b. */
export function isNewer(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

// Checked once per app launch and shared by every tab showing the banner.
let check: Promise<LatestRelease | undefined> | undefined;
// Hidden tabs stay mounted, so dismissing on one tab has to clear the others.
const dismissers = new Set<() => void>();

async function findUpdate(): Promise<LatestRelease | undefined> {
  const current = Constants.expoConfig?.version;
  if (!current || !EPG_BASE_URL) return undefined;
  const res = await fetch(`${EPG_BASE_URL.replace(/\/$/, '')}/version.json`);
  if (!res.ok) return undefined;
  const latest = (await res.json()) as LatestRelease;
  if (!latest.version || !isNewer(latest.version, current)) return undefined;
  if ((await AsyncStorage.getItem(DISMISSED_KEY)) === latest.version) return undefined;
  return latest;
}

/** "New version available" bar for the GitHub APK build; store builds get updates from the store. */
export function UpdateBanner() {
  const [latest, setLatest] = useState<LatestRelease>();

  useEffect(() => {
    if (!showUpdateBanner) return;
    check ??= findUpdate().catch(() => undefined);
    check.then(setLatest);
    const clear = () => setLatest(undefined);
    dismissers.add(clear);
    return () => {
      dismissers.delete(clear);
    };
  }, []);

  if (!latest) return null;

  const dismiss = () => {
    dismissers.forEach((clear) => clear());
    check = Promise.resolve(undefined);
    AsyncStorage.setItem(DISMISSED_KEY, latest.version).catch(() => {});
  };

  return (
    <View style={styles.bar}>
      <Ionicons name="arrow-down-circle" size={22} color={colors.accent} />
      <Pressable style={styles.textWrap} onPress={() => Linking.openURL(latest.apkUrl)} accessibilityRole="link">
        <Text style={styles.title}>EPG OG {latest.version} is available</Text>
        <Text style={styles.sub}>Tap to download the update</Text>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss update notice">
        <Ionicons name="close" size={20} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.cell,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  textWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 1 },
});
