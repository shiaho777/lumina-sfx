import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planEdit, reviseEdit } from '../scripts/edit-score.mjs';
import { geometryConflict } from '../scripts/source-perspective.mjs';
import { resolveListeningBrief } from '../scripts/listening-brief.mjs';
import { rankByIntent } from '../scripts/intent-search.mjs';
import { cuePlacement } from '../scripts/cue-placement.mjs';
import { silentGesture } from '../scripts/editorial-intent.mjs';
const bank = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url))).sounds;
const src = (id) => bank.find((s) => s.id === id);
const timeline = (events, extra = {}) => ({ id: 'spotting', fps: 30, durationFrames: 150, events, ...extra });
const mark = (id, action, frame, extra = {}) => ({ id, action, frame, ...extra });
const plan = (events, extra = {}, track) => planEdit(timeline(events, extra), bank, {}, {}, track);
test('physical, glass and software inputs retain the observed mechanism', () => {
  const marks = [
    mark('finger', 'press', 2, { device: 'tablet' }),
    mark('type', 'type', 8, { device: 'on-screen keyboard', keyFrames: [8, 12] }),
    mark('subtle', 'press', 20, { feedback: 'subtle', device: 'phone' }),
    mark('tip', 'press', 40, { device: 'stylus' }),
    mark('barrel', 'press', 52, { device: 'pen side button' }),
    mark('physical', 'press', 75, { device: 'stylus', physicalContact: true }),
    mark('glass', 'press', 81, { device: 'touchscreen', physicalContact: true }),
  ];
  assert.deepEqual(
    plan(marks).cues.map((c) => c.soundId ?? c.decision),
    [
      'silence',
      'silence',
      'soft-touch-acknowledgement',
      'review',
      'stylus-barrel-press',
      'stylus-tip-on-tablet-glass',
      'fingertip-on-display-glass',
    ],
  );
  const shot = plan([
    mark('pen', 'press', 50, { device: 'stylus', physicalContact: true, gesture: 'ink' }),
    mark('chip', 'tab', 51, { gesture: 'ink' }),
  ]).cues;
  assert.equal(shot[0].soundId, 'stylus-tip-on-tablet-glass');
  assert.equal(shot[1].decision, 'silence');
  assert.ok(silentGesture('tap the button labelled “Engine on fire” on a phone'));
  assert.equal(
    rankByIntent(bank, 'one discreet notification without a chime')[0].id,
    'menu-confirm-spring-detent',
  );
  assert.equal(rankByIntent(bank, 'a tap on a phone with subtle feedback')[0].id, 'soft-touch-acknowledgement');
  assert.equal(rankByIntent(bank, 'stylus tip tapping glass')[0].id, 'stylus-tip-on-tablet-glass');
});
test('gesture grouping respects the device, soundtrack and whole-edit contact limit', () => {
  const events = [
    mark('raw', 'press', 10, { gesture: 'nav', device: 'touchscreen' }),
    mark('tab', 'tab', 11, { gesture: 'nav' }),
    mark('original', 'press', 30, { sourceContact: true }),
    mark('loader', 'spinner', 55),
    mark('result', 'confirm', 90, { priority: 9 }),
  ];
  const cues = plan(events).cues;
  assert.equal(cues.find((c) => c.id === 'tab').device, 'touch');
  assert.deepEqual(
    plan(events, { maxAddedContacts: 1 }).cues.map((c) => c.decision),
    ['silence', 'silence', 'reuse', 'silence', 'play'],
  );
  assert.deepEqual(
    plan(events, { feedback: 'none' }).cues.map((c) => c.decision),
    ['silence', 'silence', 'reuse', 'silence', 'silence'],
  );
  assert.ok(
    plan([mark('x', 'notice', 10)], { avoid: ['chime'] }).cues[0].soundId === 'menu-confirm-spring-detent',
  );
  assert.throws(() => plan(events, { maxAddedContacts: -1 }));
});
test('palette ranking fits rate and feature, with gain tied to the marked soundtrack window', () => {
  const solo = plan([mark('a', 'press', 30, { device: 'mouse' })]).cues[0];
  const rapid = plan([
    mark('a', 'press', 30, { device: 'mouse' }),
    mark('b', 'press', 38, { device: 'mouse' }),
  ]).cues[0];
  assert.equal(solo.soundId, 'desktop-mouse-press');
  assert.equal(rapid.soundId, 'quiet-mouse-press');
  assert.ok(rapid.gainDb < solo.gainDb);
  const source = {
    windowSec: 0.05,
    windows: Array.from({ length: 100 }, (_, i) => ({
      energy: i < 35 ? 0.0001 : 0.02,
      peak: i < 35 ? 0.04 : 0.22,
    })),
  };
  const keys = plan([mark('keys', 'type', 30, { keyFrames: [30, 60] })], { speech: [[28, 65]] }, source)
    .cues[0];
  assert.ok(keys.keyGainOffsets[1] > keys.keyGainOffsets[0] + 2);
  const quiet = plan([mark('a', 'confirm', 30)], { context: 'speech' }).cues[0];
  const hero = plan([mark('a', 'confirm', 30)], { context: 'hero' }).cues[0];
  assert.notEqual(quiet.soundId, hero.soundId);
});
test('only the requested unlocked performance changes and audition alternatives have matched active level', () => {
  const p = plan([mark('one', 'tab', 15), mark('two', 'tab', 75)]);
  const locked = reviseEdit(p, [{ id: 'one', lock: true }], bank);
  const adjusted = reviseEdit(locked, [{ action: 'tab', trimDb: -4 }], bank);
  assert.deepEqual(adjusted.cues[0], locked.cues[0]);
  assert.equal(adjusted.cues[1].gainDb, p.cues[1].gainDb - 4);
  assert.throws(() => reviseEdit(locked, [{ id: 'one', mute: true }], bank), /Unlock/);
  const softened = reviseEdit(locked, [{ id: 'two', character: 'less-bright' }], bank);
  assert.deepEqual(softened.cues[0], locked.cues[0]);
  assert.equal(softened.cues[1].edgeDb, -4);
  const a = p.cues[0],
    alt = reviseEdit(p, [{ id: 'one', soundId: a.alternatives[0] }], bank);
  assert.notEqual(alt.cues[0].gainDb, a.gainDb);
  assert.deepEqual(alt.cues[1], p.cues[1]);
});
test('the scene resolver recognizes listener UI, an explicitly located keyboard, and already authored acoustics', () => {
  const tab = src('settings-tab-walnut-detent');
  assert.equal(cuePlacement(tab, 'tab traveling past listener', true).motion, 'listener-fixed');
  assert.equal(
    cuePlacement(src('propeller-flyby'), 'propeller flying past listener', true).motion,
    'in-source',
  );
  assert.ok(geometryConflict(src('distant-thunder-across-a-lake'), { acoustics: { distanceM: 900 } }));
  assert.ok(geometryConflict(src('arcade-marksman-long-canyon-echo'), { placement: { room: 'hangar' } }));
  const key = src('laptop-scissor-keyboard-key-down');
  const layer = { query: key.id, label: 'desk', placement: { kind: 'point', position: [2, 0, -1] } };
  const brief = { id: 'desk', schemaVersion: 2, scope: 'world', layers: [layer] };
  assert.equal(resolveListeningBrief(brief, bank).design?.layers[0].placement.kind, 'point');
  assert.equal(
    resolveListeningBrief({ ...brief, layers: [{ ...layer, query: tab.id }] }, bank).decision,
    'review',
  );
});

test('touch feedback retains one pulse, honours quiet gaps and migrates an approved button', () => {
  const events = [mark('open', 'press', 20), mark('engage', 'toggle-on', 50), mark('accept', 'confirm', 90)];
  const input = timeline(events, { device: 'touchscreen', feedback: 'subtle' });
  const track = (energy) => ({ windowSec: .02, windows: Array.from({ length: 250 }, () => ({ energy, peak: Math.sqrt(energy) })) });
  const quiet = planEdit(input, bank, {}, {}, track(0)).cues;
  const bed = planEdit(input, bank, {}, {}, track(.002)).cues;
  assert.equal(new Set(quiet.map(c => c.soundId + '/' + c.seed)).size, 1);
  assert.ok(quiet.every((c, i) => c.fixedTake && c.gainDb <= bed[i].gainDb - 3));
  const player = { signatures: { confirm: { id: quiet[2].soundId, revision: quiet[2].revision, seed: 123, trimDb: -1 } } };
  assert.equal(planEdit(input, bank, player).cues[2].seed, 123);
  assert.equal(planEdit(timeline(events, { device:'phone' }), bank).cues[2].decision, 'silence');
});

test('a reversal trims only the motion that was still running on the same surface', () => {
  const move = (id, frame, apex, endFrame, direction, target='drawer') =>
    mark(id, 'slide', frame, { target, endFrame, syncFrame: apex, direction, accent: true });
  const cases = [move('out', 2, 18, 30, 'left'), move('back', 14, 22, 28, 'right'),
    move('again', 38, 43, 59, 'left'), move('other', 40, 45, 62, 'right', 'strip'),
    move('reverse', 49, 57, 75, 'right')];
  const [early, back, late, other, reverse] = plan(cases).cues;
  assert.equal(early.decision, 'silence');
  assert.equal(back.decision, 'play');
  assert.equal(late.endFrame, 49);
  assert.equal(late.syncFrame, 43);
  assert.equal(other.endFrame, 62);
  assert.equal(reverse.soundId, back.soundId);
  assert.equal(late.seed, reverse.seed);
});

test('world context supplies the mounted surface and short indoor return only when supported', () => {
  const run = (layer, viewpoint, opts={}) => resolveListeningBrief({
    id:'physical-sources', schemaVersion:2, scope:'world', viewpoint, layers:[layer], ...opts
  }, bank).design.layers[0];
  const p = {kind:'point',position:[4,0,-1],refDistance:2};
  const glass = run({label:'roof',query:'steady rainfall',placement:p}, 'Rain streaks down the skylight.');
  assert.equal(glass.id,'rain-on-window-loop');
  assert.equal(run({label:'air',query:'steady rainfall',placement:p},'Rain streaks down the skylight.').id,'rainfall-open-air-clean-loop');
  assert.equal(run({label:'roof',query:'rainfall-open-air-clean-loop',placement:p},'Rain streaks down the skylight.').id,'rainfall-open-air-clean-loop');
  const key = { label:'key', query:'mechanical keyboard key down', placement:p };
  const booth = run(key,'The viewer hears an operator in the booth.');
  assert.equal(booth.macros.space,'small_room');
  assert.ok(booth.muffle.cutoffHz < 7000);
  assert.equal(booth.placement,p);
  assert.equal(run(key,'The desk is outside.').muffle,undefined);
  assert.equal(run({...key,macros:{space:'dry'}},'Inside the office.').muffle,undefined);
  assert.equal(run({...key,placement:{...p,position:[.25,0,0]}},'Inside the booth.').macros,undefined);
});

test('clean world briefs recognize the contact material and a single located bell', () => {
  const place = { kind: 'point', position: [3, 0, -2] };
  const resolve = (query) => resolveListeningBrief({
    id: 'room', schemaVersion: 2, scope: 'world', sourcePolicy: 'clean',
    layers: [{ label: 'source', query, placement: place }],
  }, bank).design?.layers[0];
  const ring = resolve('one mechanical phone ring');
  assert.equal(ring?.id, 'desk-telephone-bell-ring');
  assert.equal(ring.placement, place);
  assert.equal(resolve('mechanical telephone bell ringing')?.id, ring.id);
  assert.equal(resolve('rainfall on leaves')?.id, resolve('rain on leaves')?.id);
  assert.match(resolve('rainfall on leaves').id, /leaves/);
});

test('one project switch revision follows the hardware through different screen actions', () => {
  const original = plan([
    mark('open', 'press', 2, { device: 'mouse' }),
    mark('select', 'tab', 15, { device: 'mouse' }),
    mark('captured', 'press', 29, { device: 'mouse', sourceContact: true }),
    mark('pad', 'press', 40, { device: 'trackpad' }),
    mark('approved', 'back', 54, { device: 'mouse' }),
  ]);
  const locked = reviseEdit(original, [{ id: 'approved', lock: true }], bank);
  const updated = reviseEdit(locked, [{ signature: 'press/mouse', trimDb: -3, character: 'less-bright' }], bank);
  for (const [i, c] of updated.cues.entries()) {
    if (i > 1) assert.deepEqual(c, locked.cues[i]);
    else {
      assert.equal(c.gainDb, locked.cues[i].gainDb - 3);
      assert.equal(c.edgeDb, (locked.cues[i].edgeDb ?? 0) - 4);
      assert.equal(c.soundId, locked.cues[i].soundId);
      assert.equal(c.seed, locked.cues[i].seed);
    }
  }
  assert.throws(() => reviseEdit(locked, [{ signature: 'press/mouse', soundId: 'rain-on-window-loop' }], bank));
});

test('swapping a swipe family keeps the left and right performances at picture speed', () => {
  const original = plan([
    mark('in', 'slide', 2, { direction: 'right', endFrame: 28, accent: true }),
    mark('out', 'slide', 40, { direction: 'left', endFrame: 66, accent: true }),
  ]);
  const swap = original.cues[0].alternatives.find(id => id.endsWith('-right') &&
    original.cues[1].alternatives.includes(id.replace(/-right$/, '-left')));
  assert.ok(swap);
  const updated = reviseEdit(original, [{ signature: original.cues[0].signature, soundId: swap }], bank);
  for (const [i,c] of updated.cues.entries()) {
    assert.equal(c.soundId, i ? swap.replace(/-right$/, '-left') : swap);
    assert.equal(c.syncFrame, original.cues[i].syncFrame);
    assert.equal(c.speed, Math.max(.85, Math.min(1.25, src(c.soundId).durationSec * 30 / 26)));
  }
});

test('the electronic phone default preserves an approved earlier felt tick and its seed', () => {
  const input = timeline([mark('confirm', 'confirm', 24, { device:'phone', feedback:'subtle' })]);
  const felt = bank.find(s => s.id === 'settings-focus-felt-tick');
  const approved = { signatures: { confirm: {id:felt.id,revision:felt.revision,seed:810,trimDb:-2} } };
  const [fresh] = planEdit(input, bank).cues;
  const [kept] = planEdit(input, bank, approved).cues;
  assert.equal(fresh.soundId, 'soft-touch-acknowledgement');
  assert.equal(kept.soundId, felt.id);
  assert.equal(kept.seed, 810);
  assert.equal(kept.projectTrimDb, -2);
});
test('physical spacebars keep their mechanism and do not sound for virtual keys or printed labels', () => {
  const [board, laptop, phone, letter] = plan([
    mark('a','press',10,{device:'mechanical keyboard',key:' '}),
    mark('b','press',30,{device:'laptop keyboard',brief:'Press the space bar once'}),
    mark('c','press',50,{device:'onscreen keyboard',key:'Space'}),
    mark('d','press',70,{device:'mechanical keyboard',label:'Space bar'}),
  ]).cues;
  assert.equal(board.soundId,'linear-mechanical-keyboard-spacebar-down');
  assert.equal(laptop.soundId,'laptop-scissor-keyboard-spacebar-down');
  assert.equal(phone.decision,'silence');
  assert.equal(letter.soundId,'linear-mechanical-keyboard-key-down');
});
