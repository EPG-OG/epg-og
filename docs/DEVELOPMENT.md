# EPG OG: developer guide

How the app, the listings pipeline and releases fit together. For what the app does, see the [README](../README.md).

## Run it

```bash
npm install
npm run web        # quick look in the browser
npm start          # then scan the QR code with Expo Go, or press a / i
```

Reminders use `expo-notifications`. They don't fire on web.

## How updates reach people

| What changed | How it gets to installed apps |
| --- | --- |
| **TV listings and channel lineup** | Automatic. `.github/workflows/epg.yml` rebuilds them every 6 hours to GitHub Pages; the app downloads them on launch and hourly. |
| **App code** (screens, layout, text, bug fixes) | Run `npm run update -- "what changed"`. It publishes to both the GitHub APK and the store builds. Installed apps download it on next launch and use it on the launch after. No new APK needed. |
| **Native changes** (new native library, icon, app name, permissions, Expo SDK upgrade) | Bump `version` in `app.json` and publish a new APK (below). APK users see a "new version available" banner in the app; store users get it through the store. |

**What's new pop-up:** before publishing an update people would notice, add an entry at the top of `WHATS_NEW` in `src/whatsNew.ts`, with the next `id`. It pops up once on each phone's next launch, and stays available from the link beside the version number. Bug fixes and listings changes don't need one.

## Two versions of the app

`EXPO_PUBLIC_DISTRIBUTION` (set per build profile in `eas.json`, read in `src/distribution.ts`) produces two variants from the same code:

| | GitHub APK (`apk` profile) | Play Store / App Store (`production` profile) |
| --- | --- | --- |
| Last tab | Buy Me a Coffee | About (store rules forbid links to outside payment pages) |
| "New version available" banner | Yes, from `version.json` on the website | No, the store handles updates |
| Update channel | `production` | `store` |

## Publishing a new APK to GitHub

```bash
sh scripts/release-apk.sh v1.1.0 "What changed, in Markdown"
```

Bump `version` in `app.json` first. This builds on EAS (profile `apk`), waits, then runs the **Publish release** workflow (`.github/workflows/release.yml`), which downloads the APK, creates the GitHub release as `github-actions[bot]` with it attached as `EPG-OG.apk`, and refreshes the website so `version.json` and the in-app banner announce it. The website's download button always points at the newest release.

Play Store builds use the `production` profile (`npx eas-cli@latest build -p android --profile production`). The GitHub APK and the Play Store version are signed differently, so a phone can't switch between them without uninstalling first.

## Guide data

`scripts/build-epg.mjs` downloads the free XMLTV feeds from [epgshare01](https://epgshare01.online/) (`epg_ripper_US2`, `epg_ripper_UK1`). It keeps only the channels in `scripts/lineup.mjs` for the next 48 hours, measures each logo's padding so the app can crop it, and writes `epg/us.json` and `epg/uk.json`.

```bash
npm run epg
```

- **Logos:** the app's background is dark, so `scripts/dark-logos.json` maps channels to official dark-background logos (re-run `node scripts/find-dark-logos.mjs` after adding US channels). Anything still too dark gets a light backing, flagged `dl` in the JSON, and generic placeholder images are replaced by the channel name.
- **Change channels or categories:** edit `scripts/lineup.mjs`. Channel IDs come from the matching `.txt` list on epgshare01, and the script warns about any ID it can't find. Pushing the change updates the hosted listings within minutes.
- The listings workflow also re-enables itself on every scheduled run, so GitHub's 60-day inactivity pause never kicks in.
- **Safety check:** `scripts/check-listings.mjs` compares each new build with what's live. If a country loses more than 15% of its channels, its listings run less than 24 hours ahead, or the feed couldn't be downloaded, the live listings are published again instead and the run fails so GitHub emails you. The rest of the site still updates. After deliberately removing lots of channels, run **Update EPG** from the Actions tab with **force** ticked.
- `EPG_BASE_URL` in `src/config.ts` points at `https://epgog.com`. The app saves each download on the phone and doesn't download again until that copy is 6 hours old, when a newer one should exist. If the site can't be reached, it keeps using the saved copy.
- **Artwork:** each show's `i` field is an image id or URL, which `src/epg/programme.ts` turns into a URL for the details sheet. Paid programming is matched by title in the same file and dimmed in the guide.

## Notes

- Apple and tipping: the US App Store allows external payment links, but other storefronts may reject an external "tip" link. A fallback is an in-app-purchase tip jar.
- Channel logos are the broadcasters' trademarks. They're shown for identification only, and the About text in the Coffee tab says so.
- `assets/icon-source.png` is the original artwork. `adaptive-icon.png`, `icon.png` and `favicon.png` use its letters, enlarged and brightened, on a redrawn sky and grid. Changing the icon needs a new APK.
