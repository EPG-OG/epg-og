// Where the app downloads guide data from. Point this at the GitHub Pages site that
// .github/workflows/epg.yml publishes (custom domain epgog.com, set in the repo Pages settings).
// Left empty, the app uses the snapshot bundled from ./epg (handy for development).
export const EPG_BASE_URL: string = 'https://epgog.com';

// Your Buy Me a Coffee page.
export const BUY_ME_A_COFFEE_URL: string = 'https://buymeacoffee.com/epgog';

// How far back / ahead the grid shows, in hours.
export const GUIDE_HOURS_BACK = 1;
export const GUIDE_HOURS_AHEAD = 24;
