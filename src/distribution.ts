// Which channel this copy of the app was built for, set per build profile in eas.json and
// inlined at bundle time:
//   'github' – the APK from GitHub Releases: shows the Buy Me a Coffee link and the update banner.
//   'store'  – Google Play / App Store: no external payment links (store payment rules), and
//              the store itself handles app updates.
export const DISTRIBUTION: 'github' | 'store' = process.env.EXPO_PUBLIC_DISTRIBUTION === 'store' ? 'store' : 'github';

export const showTipJar = DISTRIBUTION === 'github';
export const showUpdateBanner = DISTRIBUTION === 'github';
