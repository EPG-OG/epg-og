# EPG OG

A free TV guide for Android and iPhone (Expo / React Native), styled after a dark set-top box EPG.

- **USA** and **UK** tabs, each split into Sports, Entertainment, News, Movies, Kids, Documentary and All Channels
- Channel numbers, broadcaster logos, a live now-line, and New/Live badges
- **Watchlist**: tap the bookmark on any upcoming show; you get a notification 5 minutes before it starts
- **Buy Me a Coffee** tab

## Run it

```bash
npm install
npm run web        # quick look in the browser
npm start          # then scan the QR code with Expo Go, or press a / i
```

Reminders use `expo-notifications`. They don't fire on web. For reliable testing on a phone, use a development build: `npx expo run:android`, or `eas build --profile development`.

## Guide data

`scripts/build-epg.mjs` downloads the free XMLTV feeds from [epgshare01](https://epgshare01.online/) (`epg_ripper_US2`, `epg_ripper_UK1`). It keeps only the channels in `scripts/lineup.mjs` for the next 48 hours, measures each logo's padding so the app can crop it, and writes `epg/us.json` and `epg/uk.json`.

```bash
npm run epg
```

- **Change channels or categories:** edit `scripts/lineup.mjs`. Channel IDs come from the matching `.txt` list on epgshare01, and the script warns about any ID it can't find.
- **Keep listings fresh in production:** push to GitHub and enable Pages (Settings → Pages → Source: GitHub Actions). `.github/workflows/epg.yml` then rebuilds every 6 hours. Set `EPG_BASE_URL` in `src/config.ts` to `https://<you>.github.io/<repo>`. While it's empty, the app uses the snapshot bundled from `epg/`, which goes stale after about 2 days.

## Before you publish

- Set `BUY_ME_A_COFFEE_URL` in `src/config.ts`.
- Replace the placeholder icons in `assets/` and the app name in `app.json`.
- Apple and tipping: the US App Store now allows external payment links, but other storefronts may reject an external "tip" link. A fallback is an in-app-purchase tip jar.
- Channel logos are the broadcasters' trademarks. They're shown for identification only, and the About text in the Coffee tab says so.
