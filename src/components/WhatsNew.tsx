import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { WHATS_NEW, type WhatsNewEntry } from '../whatsNew';

const SEEN_KEY = 'whats-new-seen:v1';
// The watchlist is saved on every launch, so having one means the app has been opened before.
const EXISTING_USER_KEY = 'watchlist:v1';
const MAX_ENTRIES = 3;

export function WhatsNewModal({ entries, onClose }: { entries: WhatsNewEntry[]; onClose: () => void }) {
  return (
    <Modal visible={entries.length > 0} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.heading} accessibilityRole="header">
            What's new
          </Text>
          <ScrollView style={styles.body}>
            {entries.map((entry) => (
              <View key={entry.id} style={styles.entry}>
                <Text style={styles.title}>{entry.title}</Text>
                {entry.items.map((item) => (
                  <View key={item.text} style={styles.item}>
                    <Ionicons name={item.icon} size={20} color={colors.accent} />
                    <Text style={styles.text}>{item.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <Text style={styles.buttonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Pops up once after an update with anything added to WHATS_NEW since this phone last saw it. */
export function WhatsNewPrompt() {
  const [entries, setEntries] = useState<WhatsNewEntry[]>([]);
  const latest = WHATS_NEW[0].id;

  useEffect(() => {
    AsyncStorage.multiGet([SEEN_KEY, EXISTING_USER_KEY])
      .then(([[, seen], [, existing]]) => {
        // A new install has nothing to compare with: everything is new.
        if (seen === null && existing === null) return AsyncStorage.setItem(SEEN_KEY, String(latest));
        setEntries(WHATS_NEW.filter((e) => e.id > Number(seen ?? 0)).slice(0, MAX_ENTRIES));
      })
      .catch(() => {});
  }, [latest]);

  const close = () => {
    setEntries([]);
    AsyncStorage.setItem(SEEN_KEY, String(latest)).catch(() => {});
  };

  return <WhatsNewModal entries={entries} onClose={close} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.65)' },
  card: { width: '100%', maxWidth: 420, maxHeight: '85%', padding: 20, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  body: { flexGrow: 0, marginTop: 4 },
  entry: { marginTop: 12, gap: 12 },
  title: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  item: { flexDirection: 'row', gap: 12 },
  text: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 21 },
  button: { alignItems: 'center', marginTop: 20, paddingVertical: 13, borderRadius: 10, backgroundColor: colors.accent },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '800' },
});
