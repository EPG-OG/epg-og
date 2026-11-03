import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { Follow } from '../watchlist/follows';
import { useWatchlist } from '../watchlist/WatchlistContext';

const regionLabel: Record<Follow['region'], string> = { us: 'USA', uk: 'UK', all: 'USA + UK' };

/** Followed shows and keywords. Matching airings are added to the watchlist automatically. */
export function FollowingPanel() {
  const { follows, follow, unfollow, items } = useWatchlist();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  const add = () => {
    if (!text.trim()) return setError('Type a show, team or sport first');
    follow('keyword', text, 'all');
    setText('');
  };

  return (
    <View style={styles.panel}>
      <View style={styles.headRow}>
        <Ionicons name="repeat" size={18} color={colors.accent} />
        <Text style={styles.head}>Following</Text>
      </View>
      <Text style={styles.sub}>Every new airing is added to your watchlist automatically, with a reminder.</Text>

      {follows.length > 0 && (
        <View style={styles.chips}>
          {follows.map((f) => {
            const count = items.filter((i) => i.followId === f.id).length;
            return (
              <View key={f.id} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {f.kind === 'keyword' ? `“${f.value}”` : f.value}
                </Text>
                <Text style={styles.chipMeta}>
                  {regionLabel[f.region]} · {count} upcoming
                </Text>
                <Pressable onPress={() => unfollow(f.id)} hitSlop={10} accessibilityLabel={`Stop following ${f.value}`}>
                  <Ionicons name="close-circle" size={18} color={colors.textDim} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(undefined);
          }}
          onSubmitEditing={add}
          placeholder="Follow a keyword, e.g. NASCAR, NFL"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          returnKeyType="done"
          autoCapitalize="words"
          accessibilityLabel="Keyword to follow"
        />
        <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button">
          <Text style={styles.addText}>Follow</Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.tip}>Tip: open any show and tap “Follow this show” to follow just that show.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 1, borderColor: colors.divider },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  head: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 4, lineHeight: 18 },
  chips: { marginTop: 10, gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cell,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  chipMeta: { color: colors.textDim, fontSize: 12, flex: 1 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    backgroundColor: colors.cell,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  addBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addText: { color: '#0b0d10', fontSize: 15, fontWeight: '800' },
  error: { color: colors.live, fontSize: 13, marginTop: 6 },
  tip: { color: colors.textDim, fontSize: 12, marginTop: 6 },
});
