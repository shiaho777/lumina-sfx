import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { approvedProfile } from '../scripts/edit-family.mjs';
import { planEdit, reviseEdit } from '../scripts/edit-score.mjs';

const { sounds } = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
const timeline = (events) => ({ id: 'demo', fps: 25, durationFrames: 175, events });
const finger = 'fingertip-on-display-glass';
const seat = 'paper-title-card-seat';
const phone = { id: 'save', frame: 136, device: 'touchscreen', action: 'confirm' };
const mark = {
  id: 'mark', frame: 104, endFrame: 126, syncFrame: 118, accent: true,
  brief: 'The printer’s square mark lands and seats lightly on the baseline.',
};
const cue = (event) => planEdit(timeline([event]), sounds).cues[0];

test('physical confirmation and its press retain the same device, take and gain in an approved recut', () => {
  const first = planEdit(timeline([{ ...phone, id: 'down', action: 'press', physicalContact: true }]), sounds);
  const approved = approvedProfile(reviseEdit(first, [{ id: 'down', lock: true }], sounds));
  for (const action of ['confirm', 'commit']) {
    const next = planEdit({ ...timeline([{ ...phone, action, frame: 42, physicalContact: true }]), id: 'recut' }, sounds, approved).cues[0];
    assert.deepEqual([next.soundId, next.syncFrame, next.signature, next.seed, next.gainDb],
      [finger, 42, first.cues[0].signature, first.cues[0].seed, first.cues[0].gainDb]);
  }
  assert.equal(cue({ ...phone, device: 'stylus', physicalContact: true }).soundId, 'stylus-tip-on-tablet-glass');
  const grouped = planEdit(timeline([
    { ...phone, action: 'press', id: 'down', target: 'save' },
    { ...phone, action: 'commit', target: 'save', physicalContact: true },
  ]), sounds).cues;
  assert.deepEqual(grouped.filter(c => c.decision === 'play').map(c => c.soundId), [finger]);
});

test('a positively described finger contacting the screen opts into one surface take', () => {
  const brief = 'A real light fingertip contacting glass; no electronic melody.';
  assert.equal(cue({ ...phone, brief }).soundId, finger);
  assert.equal(cue({ ...phone, device: undefined, brief }).soundId, finger);
  assert.equal(cue({ ...phone, brief: 'Her fingertip gently taps the phone display.' }).soundId, finger);
  for (const note of [
    'The fingertip hovers over glass.', 'No fingertip taps the glass.',
    'The label reads “finger taps the glass”.',
  ]) assert.equal(cue({ ...phone, brief: note }).decision, 'silence', note);
  assert.equal(cue({ ...phone, brief, physicalContact: false }).decision, 'silence');
});

test('source, feedback and silent gestures retain their policies on surface input', () => {
  const actual = { ...phone, physicalContact: true };
  assert.equal(cue(phone).decision, 'silence');
  assert.equal(cue({ ...actual, feedback: 'none' }).decision, 'silence');
  assert.equal(cue({ ...actual, feedback: 'subtle' }).soundId, 'soft-touch-acknowledgement');
  assert.equal(cue({ ...actual, soundId: 'menu-confirm-spring-detent' }).soundId, 'menu-confirm-spring-detent');
  assert.equal(cue({ ...actual, sourceContact: true }).decision, 'reuse');
  assert.equal(cue({ ...actual, sourceContact: 'uncertain' }).decision, 'review');
  for (const action of ['hold', 'hover', 'stream']) assert.equal(cue({ ...actual, action, accent: true }).decision, 'silence');
});

test('a marked graphic settles at the assigned frame and an unaccented or held graphic adds no seat', () => {
  for (const brief of [
    mark.brief, 'The brand mark comes to rest on the baseline.',
    'The printed monogram lightly settles at center.', 'The logo settles on the baseline without overshoot.',
  ]) {
    const c = cue({ ...mark, brief });
    assert.deepEqual([c.action, c.soundId, c.syncFrame, c.fitMotion], ['land', seat, 118, true], brief);
  }
  assert.equal(cue({ ...mark, action: 'hold' }).decision, 'silence');
  assert.equal(cue({ ...mark, feedback: 'none' }).decision, 'silence');
  assert.equal(cue({ ...mark, sourceContact: true }).decision, 'reuse');
  assert.equal(cue({ ...mark, sourceContact: 'uncertain' }).decision, 'review');
  assert.equal(cue({ ...mark, brief: 'The wordmark settles in silence.' }).decision, 'silence');
  assert.equal(cue({ ...mark, brief: 'The logo settles silently and then holds.' }).decision, 'silence');
  assert.equal(cue({ ...mark, brief: 'The wordmark lands without a sound.' }).decision, 'silence');
  assert.notEqual(cue({ ...mark, accent: false }).decision, 'play');
  assert.notEqual(cue({ ...mark, syncFrame: undefined }).decision, 'play');
});

test('a named graphic near a physical landing, a printed label or a busy background adds no automatic contact', () => {
  for (const brief of [
    'The camera holds on the printer’s square mark on its baseline.',
    'The camera holds on the wordmark while leaves settle in the park.',
    'The label reads “the printer’s square mark lands on the baseline”.',
    'A box with a printed brand mark lands on a shelf.',
    'The sheet carries a logo; a paperweight lands on the sheet.',
    'A foot lands on a stair below the title card.',
    'The wordmark does not settle; the guide remains still.',
  ]) assert.notEqual(cue({ ...mark, brief }).decision, 'play', brief);
});
