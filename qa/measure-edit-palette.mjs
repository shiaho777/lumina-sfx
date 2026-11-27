// Measure the actual balanced masters used by picture scoring. Run after changing one of these takes.
import { readFile, writeFile } from 'node:fs/promises';
import { renderChannels, SAMPLE_RATE } from '../engine/render.ts';
import { defaultPalette } from '../scripts/edit-score.mjs';
const { sounds } = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
const ids = new Set([
  ...defaultPalette,
  ...sounds
    .filter(
      (s) =>
        s.isolation === 'isolated' &&
        !s.cleanHold &&
        !s.auditionNote &&
        (s.editorialAction || ['interface', 'ambience', 'vehicle', 'foley'].includes(s.mixRole)),
    )
    .map((s) => s.id),
]);
const results = {};
for (const id of [...ids].sort()) {
  const { default: recipe } = await import('../recipes/' + id + '.ts');
  const takes = [];
  for (const seed of [11, 37, 89]) {
    const channels = renderChannels(recipe, { seed, level: 'balanced' });
    const window = Math.round(0.035 * SAMPLE_RATE);
    const energy = new Float64Array(channels[0].length);
    let total = 0,
      high = 0,
      peak = 0,
      rolling = 0,
      strongest = 0;
    for (const pcm of channels) {
      let low = 0;
      const alpha = 1 - Math.exp((-2 * Math.PI * 3000) / SAMPLE_RATE);
      for (let i = 0; i < pcm.length; i++) {
        const x = pcm[i];
        low += alpha * (x - low);
        high += (x - low) ** 2 / channels.length;
        energy[i] += (x * x) / channels.length;
        peak = Math.max(peak, Math.abs(x));
      }
    }
    for (let i = 0; i < energy.length; i++) {
      total += energy[i];
      rolling += energy[i] - (energy[i - window] ?? 0);
      strongest = Math.max(strongest, rolling);
    }
    let sum = 0,
      last = 0;
    while (last < energy.length && sum < total * 0.95) sum += energy[last++];
    // Count separated energy bursts; the meaning of a rebound still comes from the recipe.
    let clusters = 0,
      quietMs = 100;
    const hop = Math.round(0.005 * SAMPLE_RATE);
    for (let i = 0; i < energy.length; i += hop) {
      let block = 0;
      for (let j = i; j < Math.min(i + hop, energy.length); j++) block += energy[j];
      if (block / hop > (strongest / window) * 0.012) {
        if (quietMs >= 30) clusters++;
        quietMs = 0;
      } else quietMs += 5;
    }
    takes.push([
      20 * Math.log10(peak),
      10 * Math.log10(strongest / window),
      (last / SAMPLE_RATE) * 1000,
      high / total,
      clusters,
    ]);
  }
  const med = (i, n) =>
    Number(
      takes
        .map((t) => t[i])
        .sort((a, b) => a - b)[1]
        .toFixed(n),
    );
  results[id] = {
    peakDb: med(0, 2),
    activeDb: med(1, 2),
    tailMs: med(2, 1),
    bright: med(3, 4),
    ...(recipe.loopable ? {} : { bursts: med(4, 0) }),
  };
}
await writeFile(
  new URL('../references/edits/palette-acoustics.json', import.meta.url),
  '{\n' +
    Object.entries(results)
      .map(([id, v]) => '  ' + JSON.stringify(id) + ': ' + JSON.stringify(v))
      .join(',\n') +
    '\n}\n',
);
