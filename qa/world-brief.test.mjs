import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { namedLayers, worldPerformance } from '../scripts/world-brief.mjs';
import { resolveListeningBrief } from '../scripts/listening-brief.mjs';
import { loadDesign } from '../scripts/remix-design.mjs';
import { renderChannels } from '../engine/render.ts';

const { sounds } = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
const brief = (layers, options = {}) => ({ schemaVersion: 2, id: 'test-film', scope: 'world', layers, ...options });
const choose = (layers, options) => resolveListeningBrief(brief(layers, options), sounds);
const obstacle = { kind: 'point', position: [4, 0, -4], obstruction: 0.6 };

test('descriptive names resolve consistently throughout a public design including a name collision', async () => {
  const input = brief([
    { label: 'Lire à côté', query: 'basketball-hardwood-single-dribble' },
    { label: 'lire-a-cote', query: 'house-sparrow-contact-call', atMarker: { layer: 'Lire à côté', name: 'impact', shiftSec: 0.4 } },
  ], { focus: { subjects: ['Lire à côté'], moments: [{ from: 0.1, to: 0.3, subjects: ['lire-a-cote'] }] } });
  const selected = resolveListeningBrief(input, sounds);
  assert.deepEqual(selected.design.layers.map(l => l.label), ['lire-a-cote-2', 'lire-a-cote']);
  assert.deepEqual(selected.design.focus.subjects, ['lire-a-cote-2']);
  assert.equal(selected.design.layers[1].atMarker.layer, 'lire-a-cote-2');
  assert.equal(selected.design.focus.moments[0].subjects[0], 'lire-a-cote');
  const { recipe } = await loadDesign(selected.design);
  const channels = renderChannels(recipe);
  assert.ok(channels.every(ch => ch.some(v => Math.abs(v) > 0.001)));
  const refs = namedLayers(brief([{ label: 'layer1' }, { label: '3rd part',
    under: { layer: 'layer1', byDb: 4 }, afterLayer: { layer: 'layer1' } }]));
  assert.equal(refs.layers[1].under.layer, refs.layers[0].label);
  assert.equal(refs.layers[1].afterLayer.layer, refs.layers[0].label);
  assert.throws(() => namedLayers(brief([{ label: 'A' }, { label: 'A' }])), /distinct/);
});

test('an available recording can sound once within a longer slot; explicit fits and exact IDs keep their contract', () => {
  const layer = { label: 'Call', query: 'one short sparrow call', durationSec: 1.8 };
  const result = choose([layer]);
  assert.equal(result.design.layers[0].id, 'house-sparrow-contact-call');
  assert.equal(result.design.layers[0].durationSec, undefined);
  assert.equal(result.warnings[0].decision, 'natural-end');
  assert.equal(choose([{ ...layer, query: 'house-sparrow-contact-call' }]).decision, 'review');
  assert.equal(choose([{ ...layer, query: 'continuous short sparrow call' }]).decision, 'review');
  assert.equal(choose([{ ...layer, fitSec: 1 }]).decision, 'review');
});

test('recording approximations disclose a secondary trait and keep strict material and surface requests intact', () => {
  const request = { query: 'leather basketball bounce on hardwood', label: 'Tip Off' };
  assert.equal(choose([request]).warnings.find(x => x.decision === 'approximation').unverified, 'leather');
  assert.equal(choose([{ ...request, exactSource: true }]).decision, 'review');
  for (const query of ['leather basketball on sandstone', 'basketball bouncing on a leather floor', 'leather basketball bounce on leather floor', 'rubber ball on leather']) {
    assert.equal(choose([{ ...request, query }]).decision, 'review');
  }
  assert.equal(choose([{ query: 'poplar leaves rustling outside the window', placement: obstacle }]).design.layers[0].id,
    'poplar-canopy-rustle-loop');
  assert.equal(choose([{ query: 'poplar leaves rustling outside the window' }]).decision, 'review');
});

test('authored settings outrank suggested quiet levels and fan speed; exclusions survive interpretation', () => {
  const leaf = { query: 'quiet wind in poplar leaves', placement: obstacle };
  assert.equal(choose([leaf]).design.layers[0].gain, 0.56);
  assert.equal(choose([{ ...leaf, gain: 0.9 }]).design.layers[0].gain, 0.9);
  const fan = { query: 'low speed desk fan', params: { speed: 0.77 } };
  assert.equal(choose([fan]).design.layers[0].params.speed, 0.77);
  assert.equal(choose([{ query: 'quiet wind in poplar leaves without poplar' }]).decision, 'review');
  assert.match(worldPerformance('a tap without a passing engine', { placement: { path: [{}] } }).query, /without a passing engine/);
});

test('a partly supported commission can audition the independent sources, without silently delivering a substitute', async () => {
  const request = brief([
    { label: 'Glass harp', query: 'unobtainium harmonic chandelier' },
    { label: 'Bell', query: 'house-sparrow-contact-call', afterLayer: { layer: 'Glass harp' } },
    { label: 'Fan', query: 'desk-fan-running-loop' },
  ], { balance: 'directed', focus: { subjects: ['Glass harp'] } });
  const result = resolveListeningBrief(request, sounds);
  assert.equal(result.decision, 'review');
  assert.equal(result.design, null);
  assert.deepEqual(result.audition.layers.map(s => s.label), ['fan']);
  assert.equal(result.audition.balance, 'natural');
  assert.equal(result.audition.focus, undefined);
  await loadDesign(result.audition);
});


test('a located real source uses the same matching rules in a mixed or inferred scene', () => {
  const physical = { label:'leaves', query:'poplar leaves rustling outside the window', placement:obstacle };
  const title = { label:'menu', query:'settings-tab-walnut-detent', placement:{kind:'listener'} };
  const implicit = resolveListeningBrief({ schemaVersion:2, id:'window', layers:[physical] }, sounds);
  assert.equal(implicit.design.scope, 'world');
  const mixed = choose([physical, title], {scope:'mixed'});
  assert.deepEqual(mixed.design.layers.map(l => l.id), ['poplar-canopy-rustle-loop','settings-tab-walnut-detent']);
});
