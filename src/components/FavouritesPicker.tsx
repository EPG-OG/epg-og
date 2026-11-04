import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel, Guide, RegionKey } from '../epg/types';
import { usePreferences } from '../preferences/PreferencesContext';
import { colors } from '../theme';
import { normalize } from '../watchlist/follows';
import { ChannelLogo } from './ChannelLogo';

type Scope = RegionKey | 'all';
type Row = { region: RegionKey; channel: Channel };

const scopes: { id: Scope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'us', label: 'USA' },
  { id: 'uk', label: 'UK' },
];

type Props = { visible: boolean; guides: Partial<Record<RegionKey, Guide>>; onClose: () => void };

/** Full-screen list of every channel, with a star to add or remove each favourite. */
export function FavouritesPicker({ visible, guides, onClose }: Props) {
  const { favourites, isFavourite, toggleFavourite } = usePreferences();
  const [scope, setScope] = useState<Scope>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = normalize(query);
    const out: Row[] = [];
    for (const region of ['us', 'uk'] as const) {
      if (scope !== 'all' && scope !== region) continue;
      for (const category of guides[region]?.categories ?? [])
        for (const channel of category.channels) if (!q || normalize(channel.name).includes(q)) out.push({ region, channel });
    }
    return out;
  }, [guides, scope, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.bar}>
          <Text style={styles.title}>Choose favourites</Text>
          <Pressable onPress={onClose} style={styles.done} accessibilityRole="button">
            <Text style={styles.doneText}>Done{favourites.length ? ` (${favourites.length})` : ''}</Text>
          </Pressable>
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={colors.textDim} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a channel"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            autoCorrect={false}
            accessibilityLabel="Find a channel"
          />
        </View>
        <View style={styles.scopes}>
          {scopes.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setScope(s.id)}
              style={[styles.scope, scope === s.id && styles.scopeOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === s.id }}
            >
              <Text style={[styles.scopeText, scope === s.id && styles.scopeTextOn]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.channel.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          initialNumToRender={15}
          windowSize={7}
          ListEmptyComponent={<Text style={styles.empty}>No channels match "{query.trim()}".</Text>}
          renderItem={({ item: { region, channel } }) => {
            const on = isFavourite(channel.id);
            return (
              <Pressable
                onPress={() => toggleFavourite(channel.id)}
                style={styles.row}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${channel.name}, ${region.toUpperCase()}`}
              >
                <ChannelLogo uri={channel.logo} crop={channel.lc} dark={!!channel.dl} name={channel.name} width={62} height={24} />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {channel.name}
                  </Text>
                  <Text style={styles.meta}>
                    {region.toUpperCase()} · Channel {channel.number}
                  </Text>
                </View>
                <Ionicons name={on ? 'star' : 'star-outline'} size={24} color={on ? colors.coffee : colors.textDim} />
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  done: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  doneText: { color: colors.background, fontSize: 15, fontWeight: '800' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.cell,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 10, outlineStyle: 'none' } as object,
  scopes: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  scope: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.cell },
  scopeOn: { backgroundColor: colors.cellNow },
  scopeText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  scopeTextOn: { color: colors.textOnLight },
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.cell, borderRadius: 6, padding: 12, marginBottom: 6 },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 40 },
});
