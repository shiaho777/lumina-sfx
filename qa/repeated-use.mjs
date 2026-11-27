// Exercise the installed renderer at game cadence. Optional output is an audition directory.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { composeRecipe } from '../engine/remix.ts';
import { renderChannels, SAMPLE_RATE } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';

const out = process.argv[2],
  rate = SAMPLE_RATE;
if (out) await mkdir(out, { recursive: true });
const results = [];
for (const id of [
  'rainfall-open-air-clean-loop',
  'campfire-crackle-loop',
  'interceptor-turbofan-canopy-interior-cruise-loop',
  'working-motorboat-steady-offshore-loop',
]) {
  const { default: recipe } = await import('../recipes/' + id + '.ts');
  const scene = composeRecipe({ id: 'repeat-probe' }, [{ recipe, durationSec: 75 }]);
  const pcm = renderChannels(scene)[0],
    period = Math.round(recipe.durationSec * rate);
  assert.equal(pcm.length, 75 * rate);
  let xy = 0,
    xx = 0,
    yy = 0,
    low = Infinity,
    peak = 0;
  for (let base = rate; base < pcm.length - period - rate; base += rate) {
    let energy = 0;
    for (let i = base; i < base + rate; i += 8) {
      const x = pcm[i],
        y = pcm[i + period];
      xx += x * x;
      yy += y * y;
      xy += x * y;
      energy += x * x;
      peak = Math.max(peak, Math.abs(x));
    }
    low = Math.min(low, Math.sqrt(energy / (rate / 8)));
  }
  const correlation = xy / Math.sqrt(xx * yy);
  assert.ok(Math.abs(correlation) < 0.85 && low > 0.0003 && peak < 1, id + ' ' + correlation + ' ' + low);
  results.push({
    id,
    seconds: 75,
    periodCorrelation: +correlation.toFixed(3),
    quietestSecondDb: +(20 * Math.log10(low)).toFixed(1),
  });
  if (out) await writeFile(join(out, id + '.wav'), Buffer.from(encodeWav(pcm)));
}
for (const id of ['timeline-playhead-set', 'settings-focus-felt-tick', 'edit-undo-return']) {
  const { default: recipe } = await import('../recipes/' + id + '.ts');
  const spacing = Math.round(rate * 0.155),
    n = 20,
    track = new Float32Array(spacing * n);
  let isolated = 0;
  for (let k = 0; k < n; k++) {
    const take = renderChannels(recipe, { seed: 104729 + k * 8191, level: 'balanced' })[0];
    for (let i = 0; i < Math.min(spacing, take.length); i++) track[k * spacing + i] = take[i];
    const peak = take.reduce((a, b) => Math.max(a, Math.abs(b)), 0);
    const last = track.subarray((k + 1) * spacing - 200, (k + 1) * spacing);
    if (peak > 0.005 && last.every((x) => Math.abs(x) < 0.002)) isolated++;
  }
  assert.equal(isolated, n, id);
  results.push({ id, events: n, separated: isolated });
  if (out) await writeFile(join(out, id + '.wav'), Buffer.from(encodeWav(track)));
}
console.log(JSON.stringify(results, null, 2));
