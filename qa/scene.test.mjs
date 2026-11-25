import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { composeRecipe, renderSound } from '../engine/index.ts';
import { readFile } from 'node:fs/promises';
import { loadRecipes } from '../scripts/recipes.mjs';
const tone = {
  id: 'test-tone',
  name: 'test',
  category: 'Impacts',
  tags: [],
  loopable: false,
  durationSec: 1,
  params: {},
  markers: { head: 0.12, middle: 0.6, late: 0.9 },
  render(ctx) {
    return Float32Array.from(
      { length: ctx.frames },
      (_, i) => 0.4 * Math.cos((2 * Math.PI * 240 * i) / ctx.sampleRate),
    );
  },
};
const sync = { layer: 1, name: 'middle', shiftSec: 0.01 };
const first = { recipe: tone, macros: { speed: 2 }, fromMarker: 'head', durationSec: 0.35 };
const second = {
  recipe: tone,
  atMarker: sync,
  durationSec: 0.21,
  envelope: [
    [0, 1],
    [0.1, 0.6],
    [0.2, 0],
  ],
};
const make = (...layers) => composeRecipe({ id: 'probe' }, layers);
const mix = make(first, second);
assert.ok(Math.abs(mix.durationSec - 0.46) < 1e-12);
assert.equal(mix.markers['layer2.head'], 0.37);
for (const hz of [8000, 44100, 48000]) {
  const fixed = make(first, { ...second, atMarker: undefined, offsetSec: 0.25 });
  assert.deepEqual(renderSound(mix, {}, hz), renderSound(fixed, {}, hz));
  const single = make({ recipe: tone });
  assert.deepEqual(
    renderSound(single, {}, hz),
    renderSound(
      make({
        recipe: tone,
        envelope: [
          [0, 1],
          [0.99, 1],
        ],
      }),
      {},
      hz,
    ),
  );
}
assert.throws(() => make(first, { ...second, offsetSec: 0 }), /earlier/);
assert.throws(() => make(first, { ...second, atMarker: { layer: 1, name: 'late' } }), /outside/);
assert.throws(() => make({ ...first, atMarker: sync }), /earlier/);
assert.throws(() => make({ ...first, fromMarker: 'absent' }), /marker/);
assert.throws(
  () =>
    make({
      ...first,
      envelope: [
        [0, 1],
        [0, 0],
      ],
    }),
  /envelope/,
);
assert.throws(
  () =>
    make({
      ...first,
      envelope: [
        [0, 0],
        [0.2, 0],
      ],
    }),
  /audible/,
);
assert.throws(() => composeRecipe({ id: 'probe', style: 'unknown' }, [first]), /style/);
for (const style of ['natural', 'cinematic', 'arcade']) {
  const r = composeRecipe({ id: 'styled', style }, [first]);
  assert.ok(renderSound(r, {}, 24000).some((x) => Math.abs(x) > 0.01));
}
const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
const annotated = catalog.sounds.filter((r) => r.markers);
for (const r of annotated) {
  assert.ok(r.perspective && r.contains?.length, r.id);
  for (const t of Object.values(r.markers)) assert.ok(t >= 0 && t < r.durationSec, r.id);
}
for (const name of ['wet-road-barrier', 'melee-timber-check', 'melee-steel-parry', 'dive-beneath-the-boat']) {
  const { layers, ...design } = JSON.parse(
    await readFile(new URL('../references/scenes/' + name + '.json', import.meta.url)),
  );
  const byId = new Map((await loadRecipes(new Set(layers.map((l) => l.id)))).map((r) => [r.id, r]));
  const recipe = composeRecipe(
    design,
    layers.map(({ id, ...l }) => ({ ...l, recipe: byId.get(id) })),
  );
  assert.ok(recipe.recording && recipe.additionalRecordings.length, name);
  assert.ok(Object.keys(recipe.markers).length >= 2, name);
}
console.log(
  'Passed marker timing at three rates, window/envelope validation, nested landmarks, presets, catalog annotations and four scene designs.',
);

const { loadDesign } = await import('../scripts/remix-design.mjs');
const nested = await loadDesign(
  fileURLToPath(new URL('../references/scenes/barrier-and-broken-glass.json', import.meta.url)),
);
assert.equal(nested.selected.length, 5);
assert.ok(Object.hasOwn(nested.recipe.markers, 'layer1.layer4.buckle'));
assert.ok(nested.source.includes('const group2 = composeRecipe('));
assert.ok(!nested.source.includes('wet-road-barrier.json'));
const inspect = fileURLToPath(new URL('../scripts/remix.mjs', import.meta.url));
const nestedFile = fileURLToPath(new URL('../references/scenes/barrier-and-broken-glass.json', import.meta.url));
const layout = JSON.parse(execFileSync(process.execPath, [...process.execArgv, inspect, '--spec', nestedFile, '--inspect']));
assert.deepEqual(layout.markers, nested.recipe.markers);
assert.equal(layout.layers[0].design.layers.length, 4);
assert.equal(layout.layers[1].offsetSec, nested.recipe.markers['layer1.layer4.buckle'] + 0.055);
assert.equal(layout.layers[1].endSec, nested.recipe.durationSec);
await assert.rejects(
  loadDesign({ id: 'broken', layers: [{ id: 'light-blade-swish', design: {} }] }),
  /one id or design/,
);
await assert.rejects(
  loadDesign({ id: 'broken', layers: [{ id: 'light-blade-swish', typo: 1 }] }),
  /Unknown layer/,
);
const { biquad } = await import('../engine/dsp.ts');
const dive = JSON.parse(
  await readFile(new URL('../references/scenes/dive-beneath-the-boat.json', import.meta.url)),
);
const { muffle, ...air } = dive.layers[0];
const ratio = [];
for (const layer of [air, dive.layers[0]]) {
  const { recipe } = await loadDesign({ id: 'boat-through-water', layers: [layer] });
  const pcm = renderSound(recipe).subarray(3 * 44100, 4 * 44100);
  function energy(kind, hz) {
    const a = biquad(kind, hz, 0.707, 44100),
      b = biquad(kind, hz, 0.707, 44100);
    return pcm.reduce((sum, x) => sum + b(a(x)) ** 2, 0);
  }
  ratio.push(energy('highpass', 1000) / energy('lowpass', 300));
}
const delta = 10 * Math.log10(ratio[1] / ratio[0]);
assert.ok(delta < -18, 'Submerged residual surface motor should lose its airy highs: ' + delta);
console.log(
  'Nested five-source recipe and underwater stem passed. High-to-low energy change ' + delta.toFixed(1) + ' dB.',
);

const fitted = { recipe: tone, label: 'press', fitSec: 0.5 };
const follow = { recipe: tone, label: 'release', fitSec: 0.25, afterLayer: { layer: 'press', shiftSec: -0.025 } };
const chain = make(fitted, follow);
assert.equal(chain.durationSec, 0.725);
assert.equal(chain.markers['press.middle'], 0.3);
assert.equal(chain.markers['release.middle'], 0.625);
assert.deepEqual(renderSound(chain), renderSound(make(fitted, { ...follow, afterLayer: undefined, offsetSec: 0.475 })));
const withTail = make({ recipe: tone, fitSec: 1.16, macros: { space: 'small_room' } });
assert.ok(Math.abs(withTail.durationSec - 1.16) < 1e-10);
assert.ok(Math.abs(withTail.markers['layer1.middle'] - 0.6) < 1e-10);
const fromMid = make({ recipe: tone, fromMarker: 'middle', fitSec: 0.2 });
assert.equal(fromMid.durationSec, 0.2);
assert.throws(() => make(fitted, { ...follow, label: 'press' }), /unique/);
assert.throws(() => make(fitted, { ...follow, afterLayer: { layer: 'typo' } }), /earlier/);
assert.throws(() => make({ recipe: tone, fitSec: 0.01 }), /stretch/);
assert.throws(() => make({ recipe: tone, fitSec: 1, durationSec: 2 }), /fitSec/);
assert.throws(() => make({ recipe: { ...tone, loopable: true }, label: 'press' }, follow), /Bound the loop/);
const deck = await loadDesign(fileURLToPath(new URL('../references/scenes/settings-panel-apply.json', import.meta.url)));
assert.equal(deck.recipe.isolation, 'isolated');
assert.ok(deck.recipe.markers['apply.commit'] > deck.recipe.markers['toggle.seat']);
console.log('Passed named anchors, overlap, fit duration, crop, tails and editable settings scene.');
