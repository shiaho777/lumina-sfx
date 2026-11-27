import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultPalette, eligible, planEdit, reviseEdit } from '../scripts/edit-score.mjs';
import { renderEdit } from '../scripts/edit-render.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const { sounds } = await read('../catalog.json');
const demo = await read('../references/edits/generate-settings.json');
const palette = await read('../references/edits/palette-study.json');
const make = (events, extra = {}) => ({ fps: '30000/1001', durationFrames: 360, events, ...extra });
const event = (action, frame, id, other = {}) => ({ action, frame, id, ...other });
const byId = (p, id) => p.cues.find((c) => c.id === id);
test('picture score covers the visible gesture once and uses the source track first', () => {
  const p = planEdit(demo, sounds);
  assert.deepEqual(
    p.cues.filter((c) => c.decision === 'play').map((c) => c.id),
    ['generate', 'settings-tab', 'headings'],
  );
  assert.equal(byId(p, 'headings').syncFrame, 205);
  assert.equal(byId(planEdit(palette, sounds), 'preview-button').decision, 'reuse');
  const grouped = make([
    event('press', 40, 'mouse', { gesture: 'apply', sourceContact: true }),
    event('confirm', 41, 'saved', { gesture: 'apply' }),
    event('press', 42, 'apply'),
  ]);
  assert.deepEqual(
    planEdit(grouped, sounds).cues.map((c) => c.decision),
    ['reuse', 'silence', 'play'],
  );
});
test('cause, device, current project votes and screen text have independent meanings', () => {
  const e = [
    event('press', 1, 'launch', { label: 'Launch a rocket' }),
    event('paste', 30, 'p', { device: 'mechanical keyboard' }),
    event('stream', 40, 'output'),
    event('type', 55, 'keys', { keyFrames: [55, 60] }),
    event('tab', 75, 'tab'),
    event('focus', 95, 'focus', { device: 'controller' }),
    event('hover', 105, 'hover'),
    event('press', 115, 'source', { sourceContact: 'uncertain' }),
    event('slide', 125, 'unknown-side', { accent: true }),
  ];
  const profile = { useCase: 'settings', palette: 'crisp', keyboard: 'mechanical' };
  const cool = 'settings-subtab-porcelain-tip';
  let prefs = {
    [cool]: { revision: sounds.find((s) => s.id === cool).revision, decision: 'no', useCase: 'trailer' },
  };
  let p = planEdit(make(e), sounds, profile, prefs);
  assert.deepEqual(
    p.cues.map((c) => c.soundId ?? c.decision),
    [
      'desktop-mouse-press',
      'linear-mechanical-keyboard-shortcut',
      'silence',
      'linear-mechanical-keyboard-key-down',
      cool,
      'settings-focus-felt-tick',
      'silence',
      'review',
      'review',
    ],
  );
  prefs[cool].useCase = 'settings';
  assert.equal(byId(planEdit(make(e), sounds, profile, prefs), 'tab').soundId, 'settings-tab-walnut-detent');
  prefs[cool].revision--;
  assert.equal(byId(planEdit(make(e), sounds, profile, prefs), 'tab').soundId, cool);
  assert.equal(
    byId(planEdit(make(e), sounds, { ...profile, bindings: { tab: 'settings-tab-walnut-detent' } }), 'tab')
      .soundId,
    'settings-tab-walnut-detent',
  );
  assert.equal(defaultPalette.length, new Set(defaultPalette).size);
  assert.ok(defaultPalette.every((id) => eligible(sounds.find((s) => s.id === id))));
});
test('gesture density, frame timing, neutral playback and partial revisions survive a render', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lumina-picture-test-'));
  const e = [
    event('type', 10, 'word', { keyFrames: [10, 14, 23, 30] }),
    event('tab', 90, 'prefs'),
    event('slide', 140, 'page', { endFrame: 188, accent: true, direction: 'left' }),
    event('logo', 230, 'logo'),
  ];
  const p = planEdit(make(e, { speech: [[80, 105]] }), sounds);
  const clean = planEdit(make(e), sounds);
  assert.equal(byId(p, 'prefs').gainDb, byId(clean, 'prefs').gainDb - 6);
  assert.equal(byId(p, 'page').syncFrame, 164);
  assert.ok(byId(p, 'page').speed >= 0.85);
  const revised = reviseEdit(
    p,
    [
      { action: 'tab', trimDb: -4 },
      { id: 'page', mute: true },
    ],
    sounds,
  );
  assert.deepEqual(byId(revised, 'word'), byId(p, 'word'));
  assert.equal(byId(revised, 'prefs').gainDb, byId(p, 'prefs').gainDb - 4);
  const replacement = reviseEdit(p, [{ id: 'prefs', soundId: 'settings-subtab-porcelain-tip' }], sounds);
  assert.equal(byId(replacement, 'prefs').seed, byId(p, 'prefs').seed);
  assert.throws(() => reviseEdit(p, [{ id: 'prefs', soundId: 'missing' }], sounds));
  try {
    const [a, b] = await Promise.all([
      renderEdit(p, sounds, join(dir, 'a.wav')),
      renderEdit(revised, sounds, join(dir, 'b.wav')),
    ]);
    assert.equal(a.frames, Math.round(((360 * 1001) / 30000) * 44100));
    assert.equal(a.events, 6);
    assert.equal(b.events, 5);
    const [x, y] = await Promise.all([a, b].map((o) => readFile(o.file)));
    const slice = (pcm, lo, hi) => pcm.subarray(44 + lo * 4, 44 + hi * 4);
    assert.deepEqual(slice(x, 0, 2 * 44100), slice(y, 0, 2 * 44100));
    assert.notDeepEqual(slice(x, 2 * 44100, 4 * 44100), slice(y, 2 * 44100, 4 * 44100));
    assert.ok(slice(y, 4 * 44100, 8 * 44100).every((v) => v === 0));
    assert.ok(a.peakDbfs <= -0.5 && a.monoEnergyRatio > 0.5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('invalid observations fail before export', () => {
  assert.throws(() => planEdit(make([event('tab', 0.5, 'x')]), sounds));
  assert.throws(() => planEdit(make([event('tab', 5, 'x'), event('focus', 6, 'x')]), sounds));
  assert.throws(() => planEdit(make([event('type', 5, 'x', { keyFrames: [5, 4] })]), sounds));
  assert.throws(() => planEdit(make([], { fps: '1/0' }), sounds));
  assert.throws(() => planEdit(make([], { speech: [[50, 40]] }), sounds));
  assert.equal(
    planEdit(make([event('type', 10, 'ambiguous', { endFrame: 48 })]), sounds).cues[0].decision,
    'review',
  );
});

test('unambiguous input and state markers from an editor share one contact', () => {
  const cues = planEdit(
    make([
      event('press', 24, 'a'),
      event('tab', 24, 'b'),
      event('press', 40, 'c', { target: 'dock' }),
      event('confirm', 42, 'd', { target: 'dock' }),
      event('press', 78, 'e', { target: 'left' }),
      event('tab', 78, 'f', { target: 'right' }),
    ]),
    sounds,
  ).cues;
  assert.deepEqual(
    cues.filter((c) => c.decision === 'play').map((c) => c.id),
    ['b', 'd', 'e', 'f'],
  );
});

test('a minute of mouse navigation reuses its samples through level and timing edits', async () => {
  const marks = Array.from({length:90}, (_, i) => event(i % 2 ? 'tab' : 'press', 3+i*19, 'nav-'+i, {device:'mouse'}));
  const plan = planEdit({format:'product',fps:30,durationFrames:1800,events:marks}, sounds);
  const dir = await mkdtemp(join(tmpdir(),'lumina-minute-'));
  try {
    const reference = structuredClone(plan);
    for (const c of reference.cues) c.fixedTake = false;
    const revised = reviseEdit(plan,[{id:'nav-10',trimDb:-3}],sounds);
    reference.cues[10].gainDb -= 3;
    const a = await renderEdit(revised,sounds,join(dir,'new.wav'));
    const b = await renderEdit(reference,sounds,join(dir,'reference.wav'));
    assert.equal(a.events,90);
    assert.equal(a.renderedTakes,1);
    assert.equal(b.renderedTakes,90);
    assert.deepEqual(await readFile(a.file),await readFile(b.file));
  } finally { await rm(dir,{recursive:true,force:true}); }
});
