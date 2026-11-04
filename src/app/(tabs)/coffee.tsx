import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { WhatsNewModal } from '../../components/WhatsNew';
import { BUY_ME_A_COFFEE_URL } from '../../config';
import { showTipJar } from '../../distribution';
import { useGuide } from '../../epg/useGuide';
import { usePreferences } from '../../preferences/PreferencesContext';
import { colors } from '../../theme';
import { formatDay, formatTime } from '../../time';
import { WHATS_NEW } from '../../whatsNew';

export default function CoffeeScreen() {
  const { guide } = useGuide('us');
  const { tabOrder, setTabOrder } = usePreferences();
  const [showingNew, setShowingNew] = useState(false);

  const reportBody = [
    "What went wrong? (What you tapped, which channel or show, and what happened)",
    '',
    '',
    '---',
    `EPG OG ${Constants.expoConfig?.version}`,
    `${Platform.OS} ${Platform.Version}`,
    ...(guide ? [`Listings from ${formatDay(guide.generatedAt)}, ${formatTime(guide.generatedAt)}`] : []),
  ].join('\n');
  const reportUrl = `mailto:support@epgog.com?subject=${encodeURIComponent('EPG OG problem report')}&body=${encodeURIComponent(reportBody)}`;

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
          <Text style={styles.aboutText}>
            Version {Constants.expoConfig?.version} ·{' '}
            <Text style={styles.link} onPress={() => setShowingNew(true)} accessibilityRole="button">
              What's new
            </Text>
          </Text>
        </View>

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>Arrange your tabs</Text>
          <Text style={styles.aboutText}>Hold any tab at the bottom of the screen and drag it to move it. The app opens on whichever tab is first.</Text>
          {tabOrder.length > 0 && (
            <Text style={[styles.aboutText, styles.link]} onPress={() => setTabOrder([])} accessibilityRole="button">
              Reset tab order
            </Text>
          )}
        </View>

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>Something not working?</Text>
          <Text style={styles.aboutText}>This opens your email app with the app version already filled in. Nothing is sent until you press send.</Text>
          <Pressable
            onPress={() => Linking.openURL(reportUrl).catch(() => {})}
            style={({ pressed }) => [styles.report, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Ionicons name="mail-outline" size={18} color={colors.accent} />
            <Text style={styles.reportText}>Report a problem</Text>
          </Pressable>
        </View>

        <View style={styles.official}>
          <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
          <View style={styles.officialBody}>
            <Text style={styles.aboutTitle}>Official app</Text>
            <Text style={styles.aboutText}>
              Only download EPG OG from <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync('https://epgog.com')}>epgog.com</Text>
              {showTipJar ? '' : ' or the official app store'}. EPG OG is a TV guide only: it never plays streams, sells subscriptions
              or asks for payment details. If a version does, it isn't from us.
            </Text>
            <Text style={styles.aboutText}>
              Questions? <Text style={styles.link} onPress={() => Linking.openURL('mailto:support@epgog.com')}>support@epgog.com</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
      <WhatsNewModal entries={showingNew ? WHATS_NEW : []} onClose={() => setShowingNew(false)} />
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
  report: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  reportText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  official: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  officialBody: { flex: 1, gap: 6 },
  link: { color: colors.accent, fontWeight: '700' },
});
