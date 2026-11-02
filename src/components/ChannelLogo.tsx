import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { LogoCrop } from '../epg/types';
import { colors } from '../theme';

type Props = { uri?: string; crop?: LogoCrop; name: string; width: number; height: number };

// Logos come from the EPG feed itself (the broadcasters' own artwork). Many are padded
// inside a 4:3 canvas, so when the feed build measured a crop we zoom to the visible part.
export function ChannelLogo({ uri, crop, name, width, height }: Props) {
  if (!uri) {
    return (
      <View style={[styles.fallback, { width, height }]}>
        <Text style={styles.fallbackText} numberOfLines={1}>
          {name}
        </Text>
      </View>
    );
  }

  const image = (style: object) => (
    <Image source={{ uri }} style={style} contentFit="contain" cachePolicy="disk" transition={150} accessibilityLabel={`${name} logo`} />
  );

  if (!crop) return image({ width, height });

  const [x, y, w, h, imgW, imgH] = crop;
  const scale = Math.min(width / w, height / h);
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {image({
        position: 'absolute',
        width: imgW * scale,
        height: imgH * scale,
        left: (width - w * scale) / 2 - x * scale,
        top: (height - h * scale) / 2 - y * scale,
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: colors.cell, paddingHorizontal: 3 },
  fallbackText: { color: colors.text, fontSize: 10, fontWeight: '800' },
});
