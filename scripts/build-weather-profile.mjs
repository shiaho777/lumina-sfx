// Preserve the measured power envelope of a CC0 thunderclap. Each band has one
// RMS number per 50 ms; the source recording never plays as a background bed.
import { readFile, writeFile } from 'node:fs/promises';
import reference from '../recipes/_recordings/atlas-thunder-roll.ts';
import { biquad } from '../engine/dsp.ts';
const edges = [48, 120, 280, 620, 1300],
  step = 0.05;
const envelopes = reference.takes.map((raw) => {
  const bytes = Buffer.from(raw, 'base64');
  const tracks = edges.map((h) => biquad('bandpass', h, 0.8, reference.sampleRate));
  const values = [],
    hop = Math.round(step * reference.sampleRate);
  let sums = edges.map(() => 0);
  for (let i = 0; i < bytes.length / 2; i++) {
    const x = bytes.readInt16LE(2 * i) / 32768;
    tracks.forEach((f, k) => {
      sums[k] += f(x) ** 2;
    });
    if ((i + 1) % hop === 0) {
      values.push(sums.map((v) => +Math.sqrt(v / hop).toFixed(5)));
      sums = edges.map(() => 0);
    }
  }
  return values;
});
const target = new URL('../recipes/_shared/thunder-profile.ts', import.meta.url);
const text =
  '// CC0 thunder envelope. Regenerate with scripts/build-weather-profile.mjs.\nexport const profile = ' +
  JSON.stringify({ step, edges, envelopes, credit: reference.credit }) +
  ' as const;\n';
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== text) throw Error('Drifted thunder envelope');
} else await writeFile(target, text);
