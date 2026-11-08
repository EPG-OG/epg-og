// How far the phone's text size setting may enlarge text that sits in fixed-size boxes: the guide
// grid, its header and the tab bar. Beyond this it would overlap; show details are never limited.
export const COMPACT_TEXT = 1.3;

// Dark palette sampled from the set-top box guide this app is styled after.
export const colors = {
  background: '#14161a',
  surface: '#1c1f24',
  divider: '#3a3d44',
  cell: '#2b2e35',
  cellPast: '#22252a',
  cellNow: '#e9e9ea', // airing now on the selected channel
  cellNext: '#8a8d93', // up next on the selected channel
  logoBacking: '#e6e7ea', // behind logos too dark to read on the guide
  text: '#f2f3f5',
  textDim: '#a3a7ae',
  textOnLight: '#2a2c30',
  accent: '#3ea4f0',
  live: '#ff4d4d',
  coffee: '#ffdd00',
  coffeeText: '#0d0c22',
};
