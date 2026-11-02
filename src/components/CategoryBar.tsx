import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  categories: { id: string; name: string }[];
  selected: string;
  onSelect: (id: string) => void;
};

export function CategoryBar({ categories, selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bar} style={styles.scroll}>
      {categories.map((c) => {
        const active = c.id === selected;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  bar: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: colors.cell },
  chipActive: { backgroundColor: colors.cellNow },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  labelActive: { color: colors.textOnLight },
});
