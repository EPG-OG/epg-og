import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { BUY_ME_A_COFFEE_URL } from '../../config';
import { showTipJar } from '../../distribution';
import { useGuide } from '../../epg/useGuide';
import { colors } from '../../theme';
import { formatDay, formatTime } from '../../time';

export default function CoffeeScreen() {
  const { guide } = useGuide('us');

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {showTipJar ? (
          <>
            <View style={styles.cup}>
              <Ionicons name="cafe" size={52} color={colors.coffee} />
            </View>
            <Text style={styles.title}>Enjoying the guide?</Text>
            <Text style={styles.body}>
              This app is free, with no ads and no sign-up. If it saves you some channel surfing, you can support it with a
              coffee. It keeps the listings updating.
            </Text>

            <Pressable
              onPress={() => WebBrowser.openBrowserAsync(BUY_ME_A_COFFEE_URL)}
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
              accessibilityRole="link"
            >
              <Ionicons name="cafe" size={22} color={colors.coffeeText} />
              <Text style={styles.buttonText}>Buy me a coffee</Text>
            </Pressable>
            <Text style={styles.small}>Opens buymeacoffee.com. Totally optional — the app stays free either way.</Text>
          </>
        ) : (
          // Store builds: Google Play and the App Store don't allow links to outside payment pages.
          <>
            <Image source={require('../../../assets/icon.png')} style={styles.appIcon} />
            <Text style={styles.title}>EPG OG</Text>
            <Text style={styles.body}>A free TV guide for USA and UK channels. No ads, no sign-up.</Text>
          </>
        )}

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>About the listings</Text>
          <Text style={styles.aboutText}>
            Listings come from public XMLTV guide data and refresh several times a day.
            {guide ? ` Last updated ${formatDay(guide.generatedAt)}, ${formatTime(guide.generatedAt)}.` : ''}
          </Text>
          <Text style={styles.aboutText}>
            Channel names and logos are trademarks of their respective owners and are shown for identification only. This app
            does not stream any content.
          </Text>
          <Text style={styles.aboutText}>Version {Constants.expoConfig?.version}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, alignItems: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  cup: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.cell,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  appIcon: { width: 104, height: 104, borderRadius: 24, marginTop: 24 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 20, textAlign: 'center' },
  body: { color: colors.textDim, fontSize: 16, lineHeight: 24, marginTop: 10, textAlign: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.coffee,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginTop: 28,
  },
  buttonText: { color: colors.coffeeText, fontSize: 18, fontWeight: '800' },
  small: { color: colors.textDim, fontSize: 12, marginTop: 10, textAlign: 'center' },
  about: { marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.divider, alignSelf: 'stretch', gap: 10 },
  aboutTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  aboutText: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
});
