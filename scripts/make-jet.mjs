// Draws the fighter jet for the title invasion (src/components/TitleInvasion.tsx) as a PNG: a
// generic modern stealth fighter seen from above, nose pointing right. An original drawing in the
// style of today's fighters, with no real markings. Run once after changing the drawing:
//   node scripts/make-jet.mjs <path to a folder with the sharp package installed>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const sharpFrom = process.argv[2];
const require = createRequire(path.join(sharpFrom ?? process.cwd(), 'noop.js'));
const sharp = require('sharp');

// Top half of the outline, tail (x = 0) to nose (x = 120); the bottom half mirrors it about y = 30.
const top = [
  [120, 30], [106, 26.8], [92, 23.6], [76, 21.2], // nose and chined forebody
  [42, 5], [31, 5], [37.5, 19.6], // swept wing: leading edge, tip, forward-swept trailing edge
  [28, 19.6], [13, 9.5], [5.5, 9.5], [8.5, 21.2], // swept tailplane
  [3, 24.5], // engine
];
const mirror = (pts) => pts.map(([x, y]) => [x, 60 - y]).reverse();
const outline = [...top, ...mirror(top.slice(1))].map(([x, y]) => `${x},${y}`).join(' ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60" width="240" height="120">
  <defs>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a9b1bc"/><stop offset="0.5" stop-color="#8e97a3"/><stop offset="1" stop-color="#6f7884"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d9b65a"/><stop offset="0.45" stop-color="#5b4a2a"/><stop offset="1" stop-color="#1f2630"/>
    </linearGradient>
  </defs>
  <polygon points="${outline}" fill="url(#skin)" stroke="#5c646f" stroke-width="0.8" stroke-linejoin="round"/>
  <!-- Spine highlight and wing panel lines -->
  <path d="M30 30 L104 30" stroke="#b9c1cb" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
  <path d="M74 21.4 L58 13.3 M74 38.6 L58 46.7" stroke="#6e7682" stroke-width="0.7" opacity=".8"/>
  <!-- Side intakes -->
  <polygon points="88,23.9 78,21.9 76,24.6 86,25.6" fill="#3a414b"/>
  <polygon points="88,36.1 78,38.1 76,35.4 86,34.4" fill="#3a414b"/>
  <!-- Twin canted tails -->
  <polygon points="36,24.4 22,20.5 19,21.8 31,26.2" fill="#77808b" stroke="#5c646f" stroke-width="0.5"/>
  <polygon points="36,35.6 22,39.5 19,38.2 31,33.8" fill="#77808b" stroke="#5c646f" stroke-width="0.5"/>
  <!-- Canopy -->
  <ellipse cx="96" cy="30" rx="9.5" ry="3.3" fill="url(#glass)" stroke="#3b3326" stroke-width="0.5"/>
  <!-- Engine nozzle -->
  <rect x="1.2" y="26.4" width="5" height="7.2" rx="1.6" fill="#3d434b"/>
</svg>`;

const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'assets', 'invasion', 'jet.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
