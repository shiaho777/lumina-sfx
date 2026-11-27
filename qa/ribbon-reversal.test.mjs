import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planEdit } from '../scripts/edit-score.mjs';
import { renderEdit } from '../scripts/edit-render.mjs';
import { reconform } from '../scripts/edit-recut.mjs';

const bank = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url))).sounds;
const rate = 44100;
const fps = 25;
const slide = (id, direction, frame, syncFrame, endFrame) => ({
  id, direction, frame, syncFrame, endFrame, target: 'calendar', accent: true, action: 'slide',
});
const cut = (shift = 0) => ({
  id: 'ribbon-test', fps, durationFrames: 190 + shift,
  events: [slide('out', 'right', 52 + shift, 70 + shift, 93 + shift),
    slide('back', 'left', 72 + shift, 88 + shift, 111 + shift)],
});

function energies(wav, firstFrame, lastFrame, channel = 'mono') {
  const energies = [];
  // Fold the delivered stereo master, checking 10 ms at a time against its own crest.
  for (let i = firstFrame * rate / fps; i < lastFrame * rate / fps; i += rate / 100) {
    let power = 0;
    for (let j = i; j < i + rate / 100; j++) {
      const left = wav.readInt16LE(44 + 4 * j);
      const right = wav.readInt16LE(46 + 4 * j);
      const sample = channel === 'left' ? left : channel === 'right' ? right : (left + right) / 2;
      power += sample * sample;
    }
    energies.push(power);
  }
  return energies;
}

test('a marked ribbon reverses on its frame and carries audible travel on both sides', async () => {
  const plan = planEdit(cut(), bank);
  assert.deepEqual(plan.cues.map(c => [c.motion, c.syncFrame, c.endFrame]), [['turn', 70, 72], ['turn', 88, 111]]);
  const temp = await mkdtemp(join(tmpdir(), 'ribbon-reversal-'));
  try {
    for (const [i, cue] of plan.cues.entries()) {
      const file = join(temp, cue.id + '.wav');
      await renderEdit({ ...plan, cues: [cue] }, bank, file);
      const wav = await readFile(file);
      const mono = energies(wav, cue.frame, cue.endFrame);
      const peak = Math.max(...mono);
      assert.ok(peak > 0);
      const marked = energies(wav, cue.syncFrame - 1, cue.syncFrame + 1);
      const earlyTravel = energies(wav, cue.frame + 4, cue.syncFrame - 4);
      const average = xs => xs.reduce((a, b) => a+b, 0) / xs.length;
      assert.ok(average(marked) > average(earlyTravel) * 1.8, 'The marked day is audible above the travel in mono');
      assert.ok(mono.filter(p => p > peak * 10 ** (-18 / 10)).length > mono.length * 0.8);
      const left = energies(wav, cue.frame, cue.endFrame, 'left');
      const right = energies(wav, cue.frame, cue.endFrame, 'right');
      const sum = values => values.reduce((a,b) => a+b,0);
      const third = Math.floor(left.length / 3);
      const deltaDb = 10 * Math.log10(sum(left.slice(-third)) * sum(right.slice(0, third)) /
        (sum(right.slice(-third)) * sum(left.slice(0, third))));
      assert.ok(deltaDb * (cue.direction === 'left' ? 1 : -1) > 4);
      assert.ok(wav.subarray(44, 44 + 4 * cue.frame * rate / fps).every(v => v === 0));
      assert.ok(wav.subarray(44 + 4 * cue.endFrame * rate / fps).every(v => v === 0));
      if (i === 1) assert.ok(energies(wav, cue.frame, cue.frame + 1).some(p => p > peak * 0.001));
    }
    // Equal duration, seed and marker may still mean two different performances.
    const out = plan.cues[0];
    const follow = { ...out, id: 'solo', motion: 'follow', frame: out.frame + 60,
      syncFrame: out.syncFrame + 60, endFrame: out.endFrame + 60 };
    const report = await renderEdit({ ...plan, cues: [out, follow] }, bank, join(temp, 'two-modes.wav'));
    assert.equal(report.renderedTakes, 2);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('a recut keeps approved takes while moving both ribbon accents and their turnaround', () => {
  const original = planEdit(cut(), bank);
  for (const cue of original.cues) cue.locked = true;
  const later = cut(13);
  const revised = reconform(original, planEdit(later, bank), later, bank);
  assert.deepEqual(revised.cues.map(c => [c.locked, c.motion, c.syncFrame, c.endFrame, c.seed]),
    [[true, 'turn', 83, 85, original.cues[0].seed], [true, 'turn', 101, 124, original.cues[1].seed]]);
});
