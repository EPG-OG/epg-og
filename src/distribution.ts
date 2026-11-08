import { Platform } from 'react-native';

// Which channel this copy of the app was built for, set per build profile in eas.json and
// inlined at bundle time:
//   'github' – the APK from GitHub Releases, and the browser version on epgog.com: shows the
//              Buy Me a Coffee link.
//   'store'  – Google Play / App Store: no external payment links (store payment rules), and
//              the store itself handles app updates.
export const DISTRIBUTION: 'github' | 'store' = process.env.EXPO_PUBLIC_DISTRIBUTION === 'store' ? 'store' : 'github';

/** The browser version on epgog.com, which is always the latest and can't send reminders. */
export const isWebsite = Platform.OS === 'web';

export const showTipJar = DISTRIBUTION === 'github';
export const showUpdateBanner = DISTRIBUTION === 'github' && !isWebsite;
