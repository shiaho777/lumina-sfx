// Compare same-length gestures by their changing brightness and amplitude, then check
// waveform agreement. Matches are auditions, never an instruction to delete a recipe.
import { readFile } from 'node:fs/promises';
import { renderChannels } from '../engine/render.ts';

const { sounds } = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
const signatures = [],
  bins = 48,
  probeRate = 128;
for (const { id, category, durationSec } of sounds) {
  const { default: recipe } = await import('../recipes/' + id + '.ts');
  const channels = renderChannels(recipe),
    mono = channels[0],
    profile = new Float64Array(bins * 3);
  const trace = new Float32Array(Math.min(8192, Math.ceil(mono.length / probeRate)));
  let low = 0,
    mid = 0;
  for (let i = 0; i < mono.length; i++) {
    const x = channels.length === 2 ? (mono[i] + channels[1][i]) * 0.5 : mono[i];
    low += 0.045 * (x - low);
    mid += 0.33 * (x - mid);
    const base = Math.min(bins - 1, Math.floor((i * bins) / mono.length)) * 3;
    profile[base] += low * low;
    profile[base + 1] += (mid - low) ** 2;
    profile[base + 2] += (x - mid) ** 2;
    if (i % probeRate === 0 && i / probeRate < trace.length) trace[i / probeRate] = x;
  }
  for (let i = 0; i < profile.length; i++) profile[i] = Math.sqrt(profile[i]);
  const norm = Math.hypot(...profile) || 1;
  for (let i = 0; i < profile.length; i++) profile[i] /= norm;
  signatures.push({ id, category, durationSec, profile, trace });
}
const pairs = [];
for (let i = 0; i < signatures.length; i++)
  for (let j = 0; j < i; j++) {
    const a = signatures[i],
      b = signatures[j];
    if (a.category !== b.category || Math.abs(Math.log(a.durationSec / b.durationSec)) > 0.06) continue;
    let shape = 0;
    for (let k = 0; k < a.profile.length; k++) shape += a.profile[k] * b.profile[k];
    if (shape < 0.993) continue;
    let xy = 0,
      xx = 0,
      yy = 0;
    for (let k = 0; k < Math.min(a.trace.length, b.trace.length); k++) {
      xy += a.trace[k] * b.trace[k];
      xx += a.trace[k] ** 2;
      yy += b.trace[k] ** 2;
    }
    const correlation = xy / Math.sqrt(xx * yy || 1);
    pairs.push({ a: a.id, b: b.id, shape: +shape.toFixed(4), correlation: +correlation.toFixed(4) });
  }
pairs.sort((a, b) => b.correlation - a.correlation || b.shape - a.shape);
console.log(
  JSON.stringify({ compared: sounds.length, candidates: pairs.length, pairs: pairs.slice(0, 40) }, null, 2),
);
