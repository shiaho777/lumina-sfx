import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { checkIsolatedRecipes } from '../scripts/install-files.mjs';
import { loadDesign } from '../scripts/remix-design.mjs';
import { renderSound } from '../engine/render.ts';
import { spectrum } from './metrics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(
  process.execPath,
  [
    '--disable-warning=ExperimentalWarning',
    '--experimental-strip-types',
    'scripts/build-isolated-sources.mjs',
    '--check',
  ],
  { cwd: root },
);
const { sounds } = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
const isolated = sounds.filter((r) => r.isolation === 'isolated');
await checkIsolatedRecipes(isolated);
for (const name of ['dive-beneath-the-boat', 'dogfight-cockpit', 'dogfight-exterior']) {
  const { recipe, selected } = await loadDesign(
    fileURLToPath(new URL('../references/scenes/' + name + '.json', import.meta.url)),
  );
  await checkIsolatedRecipes(selected);
  assert.equal(recipe.isolation, 'isolated');
}
const unreviewed = sounds.find((r) => r.id === 'car-wet-asphalt-pass');
await assert.rejects(checkIsolatedRecipes([unreviewed]), /Unreviewed/);
await assert.rejects(checkIsolatedRecipes([{ ...unreviewed, isolation: 'isolated' }]), /Unreviewed recording/);
async function energy(id) {
  const { default: r } = await import('../recipes/' + id + '.ts');
  return spectrum(renderSound(r), 44100).high;
}
const exterior = await energy('interceptor-turbofan-augmented-exhaust-roar-loop');
const canopy = await energy('interceptor-turbofan-canopy-interior-cruise-loop');
assert.ok(exterior > canopy * 2, 'Canopy should soften high frequency exhaust');
console.log(
  JSON.stringify({
    pass: true,
    isolated: isolated.length,
    exteriorHighShare: exterior,
    canopyHighShare: canopy,
  }),
);

// A film-winding lever belongs to cameras and projectors. The ambiguous source
// name once introduced a camera shutter into environmental wind and rain.
for (const item of sounds) {
  if (item.category === 'Weather & Ambience') {
    const credits = [item.recording, ...(item.additionalRecordings ?? [])];
    assert.ok(!credits.some(c => /old slr film camera/i.test(c?.title ?? '')), item.id);
  }
  const source = await readFile(new URL('../' + item.file, import.meta.url), 'utf8');
  if (source.includes('/demo-film-wind.ts')) assert.match(item.id, /camera|lens|reel|projector/, item.id);
}
const campfire = (await import('../recipes/campfire-crackle-loop.ts')).default;
const quiet = spectrum(renderSound(campfire, {params:{sparks:0}}),44100);
const crisp = spectrum(renderSound(campfire, {params:{sparks:1}}),44100);
assert.ok(quiet.high < crisp.high && quiet.high < .04, 'Wood snaps should soften at low settings');
