// Turns the browser version's race scene (src/components/raceScene.ts) into a plain script the
// epgog.com front page can load, so both use the same race. Run by the listings workflow:
//   node scripts/build-race.mjs _site/race.js
import fs from 'node:fs';
import ts from 'typescript';

const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/build-race.mjs <output.js>');
const source = fs.readFileSync(new URL('../src/components/raceScene.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: true },
});
if (!outputText.includes('export function startRace')) throw new Error('startRace missing from the built race script');
fs.writeFileSync(out, outputText);
console.log(`Wrote ${out} (${Math.round(outputText.length / 1024)} KB)`);
