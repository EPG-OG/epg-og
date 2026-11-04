import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/** Shown when there are no usable listings, such as a first launch with no connection. */
export function ListingsMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  message: { color: colors.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retry: { backgroundColor: colors.cell, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
