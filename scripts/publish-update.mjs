// Publishes an over-the-air (EAS Update) code update to every installed copy of the app.
// The GitHub APK and the store builds are bundled separately, because the store version
// must never contain the Buy Me a Coffee link (see src/distribution.ts).
//
// Usage: npm run update -- "Fixed the UK news channel order"

import { spawnSync } from 'node:child_process';

const message = process.argv.slice(2).join(' ').trim();
if (!message) {
  console.error('usage: npm run update -- "what changed"');
  process.exit(1);
}

const targets = [
  { channel: 'production', distribution: 'github' }, // APKs from GitHub Releases
  { channel: 'store', distribution: 'store' }, // Google Play / App Store
];

for (const { channel, distribution } of targets) {
  console.log(`\n> Publishing to "${channel}" (${distribution} build)`);
  const result = spawnSync(
    'npx',
    [
      'eas-cli@latest', 'update',
      '--channel', channel,
      '--environment', 'production',
      '--clear-cache', // a stale local bundler cache can carry the previous version number
      '--message', JSON.stringify(message),
      '--non-interactive',
    ],
    { stdio: 'inherit', shell: true, env: { ...process.env, EXPO_PUBLIC_DISTRIBUTION: distribution } },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nDone. Phones pick the update up on their next launch and use it on the one after.');
