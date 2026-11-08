import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { artworkUrl } from '../epg/programme';
import type { Channel, Programme, RegionKey } from '../epg/types';
import { usePreferences } from '../preferences/PreferencesContext';
import { colors } from '../theme';
import { formatDay, formatDuration, formatRange } from '../time';
import { isWebsite } from '../distribution';
import { remindersSupported } from '../watchlist/reminders';
import { useWatchlist } from '../watchlist/WatchlistContext';
import { ChannelLogo } from './ChannelLogo';

type Props = {
  region: RegionKey;
  selection?: { channel: Channel; programme: Programme };
  now: number;
  onClose: () => void;
};

export function ProgrammeSheet({ region, selection, now, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { isSaved, toggle, findFollow, follow, unfollow } = useWatchlist();
  const { isFavourite, toggleFavourite, reminderMinutes } = usePreferences();
  const { channel, programme: p } = selection ?? {};
  const followed = p ? findFollow('title', p.t, region) : undefined;
  const airing = p ? p.s <= now && now < p.e : false;
  const saved = channel && p ? isSaved(channel.id, p.s) : false;
  const canSave = p ? p.e > now : false;
  const progress = p && airing ? (now - p.s) / (p.e - p.s) : 0;
  const upNext = channel && p ? channel.programmes.find((x) => x.s >= p.e) : undefined;
  const artwork = p && artworkUrl(p);

  return (
    <Modal visible={!!selection} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      {channel && p && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <View style={styles.channelRow}>
            <ChannelLogo uri={channel.logo} crop={channel.lc} dark={!!channel.dl} name={channel.name} width={72} height={28} />
            <Text style={styles.channelName}>
              {channel.number} · {channel.name}
            </Text>
            <Pressable
              onPress={() => toggleFavourite(channel.id)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={isFavourite(channel.id) ? `Remove ${channel.name} from favourites` : `Add ${channel.name} to favourites`}
            >
              <Ionicons
                name={isFavourite(channel.id) ? 'star' : 'star-outline'}
                size={24}
                color={isFavourite(channel.id) ? colors.coffee : colors.textDim}
              />
            </Pressable>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textDim} />
            </Pressable>
          </View>

          <ScrollView style={styles.body}>
            {artwork && <Artwork key={artwork} uri={artwork} />}
            <Text style={styles.title}>{p.t}</Text>
            {p.st && <Text style={styles.subtitle}>{p.st}</Text>}

            <View style={styles.tags}>
              {airing && <Tag label="On now" color={colors.accent} />}
              {p.l ? <Tag label="Live" color={colors.live} /> : null}
              {p.n ? <Tag label="New" color={colors.text} /> : null}
              {p.c && <Tag label={p.c} color={colors.textDim} />}
            </View>

            <Text style={styles.when}>
              {formatDay(p.s)} · {formatRange(p.s, p.e)} · {formatDuration(p.e - p.s)}
            </Text>
            {airing && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            )}

            {canSave && (
              <Pressable
                onPress={() => toggle(region, channel, p)}
                style={[styles.saveBtn, saved && styles.saveBtnOn]}
                accessibilityRole="button"
              >
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.textOnLight : colors.text} />
                <Text style={[styles.saveText, saved && styles.saveTextOn]}>{saved ? 'On your watchlist' : 'Add to watchlist'}</Text>
              </Pressable>
            )}
            {canSave && !airing && isWebsite && (
              <Text style={styles.saveHint}>Reminders need the Android app. In the browser, your watchlist is saved but won't notify you.</Text>
            )}
            {canSave && !airing && remindersSupported && (
              <Text style={styles.saveHint}>
                <Ionicons name="notifications-outline" size={12} color={colors.textDim} /> We'll remind you {reminderMinutes} min before it starts
              </Text>
            )}

            <Pressable
              onPress={() => (followed ? unfollow(followed.id) : follow('title', p.t, region))}
              style={[styles.followBtn, followed && styles.followBtnOn]}
              accessibilityRole="button"
            >
              <Ionicons name={followed ? 'repeat' : 'repeat-outline'} size={18} color={colors.accent} />
              <Text style={styles.followText}>{followed ? 'Following every airing' : 'Follow this show'}</Text>
            </Pressable>
            <Text style={styles.saveHint}>
              {followed
                ? 'New airings are added to your watchlist automatically. Tap again to stop.'
                : 'Adds every future airing to your watchlist, with reminders'}
            </Text>

            {p.d && <Text style={styles.desc}>{p.d}</Text>}

            {upNext && (
              <View style={styles.next}>
                <Text style={styles.nextLabel}>Up next · {formatRange(upNext.s, upNext.e)}</Text>
                <Text style={styles.nextTitle}>{upNext.t}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

function Artwork({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <Image source={{ uri }} style={styles.artwork} contentFit="cover" transition={150} onError={() => setFailed(true)} accessible={false} />;
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.divider, marginBottom: 14 },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  channelName: { flex: 1, color: colors.textDim, fontSize: 14, fontWeight: '600' },
  body: { marginTop: 16 },
  artwork: { width: '100%', maxWidth: 420, alignSelf: 'center', aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: colors.cell, marginBottom: 14 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textDim, fontSize: 16, marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 12, fontWeight: '700' },
  when: { color: colors.text, fontSize: 14, marginTop: 14 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.cell, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.accent },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.cell,
  },
  saveBtnOn: { backgroundColor: colors.cellNow },
  saveText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  saveTextOn: { color: colors.textOnLight },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  followBtnOn: { backgroundColor: 'rgba(62,164,240,0.15)' },
  followText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  saveHint: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 8 },
  desc: { color: colors.textDim, fontSize: 15, lineHeight: 22, marginTop: 16 },
  next: { marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  nextLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  nextTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 4 },
});
