import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { previewMusicTimeline, readAdaptiveBank, transitionEnvelope } from '../engine/music/adaptive.ts';
import { renderAdaptivePreview } from '../engine/music/adaptive-render.ts';
import { harmonySignature, resolveHarmony } from '../engine/music/harmony.ts';
import { inspectMusic } from '../engine/music/inspect.ts';
import { addPianoResonance } from '../engine/music/pedal.ts';
import { arrangeMusic } from '../engine/music/plan.ts';
import { scheduleNotes } from '../engine/music/performance.ts';
import { renderMusic } from '../engine/music/render.ts';
import { readMusicScore } from '../engine/music/score.ts';
import { inScale, parseChord, parseKey } from '../engine/music/theory.ts';

const script = fileURLToPath(new URL('../scripts/music.mjs', import.meta.url));
const run = (...args) => {
  const result = spawnSync(process.execPath, [...process.execArgv, script, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test('modulation templates compile and report resolved keys and pivots', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'lumina-plan-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  for (const style of ['cinematic', 'menu', 'ambient', 'arcade']) {
    const draft = run('template', '--style', style, '--id', 'agent-cue');
    const file = join(folder, style + '.json');
    await writeFile(file, JSON.stringify(draft));
    const score = run('compile', file);
    const report = run('inspect', file);
    assert.deepEqual(score.sections.map(section => section.key), ['D minor', 'F major', 'D minor']);
    assert.deepEqual(report.modulations.map(change => [change.atBeat, change.from, change.to, change.bridge.kind]),
      [[8, 'D minor', 'F major', 'pivot'], [16, 'F major', 'D minor', 'dominant']]);
    assert.equal(report.modulations[1].fromChord, 'A7');
    assert.deepEqual(score.sections[1].chords, ['F', 'A7']);
    const pivot = parseChord(score.sections[0].chords.at(-1));
    assert.ok(pivot.intervals.every(interval => ['D minor', 'F major'].every(key => inScale(parseKey(key), pivot.root + interval))));
    const lead = style === 'cinematic' ? 'horn' : 'melody';
    assert.equal(score.tracks.find(track => track.id === lead).notes.find(note => note.beat >= 8).note, 60);
  }
});

test('chamber and groove templates expose different ensembles and carry an authored phrase', () => {
  for (const [style, harmony, melody] of [['chamber', 'nylon-guitar', 'cello'], ['groove', 'electric-piano', 'pluck']]) {
    const plan = run('template', '--style', style, '--id', 'ensemble-check');
    const score = arrangeMusic(plan);
    assert.equal(score.tracks.find(track => track.id === 'harmony').instrument, harmony);
    assert.equal(score.tracks.find(track => track.id === 'melody').instrument, melody);
    assert.ok(score.tracks.find(track => track.id === 'harmony').notes.length > 48);
    const part = inspectMusic(score).sections[1].tracks.find(track => track.id === 'answer');
    assert.equal(part.carriedIn, 1);
    delete plan.sections[0].statements.at(-1).carry;
    assert.throws(() => arrangeMusic(plan), /extends beyond its section/);
  }
});

test('degree motifs follow the local scale, and invalid fields report their source path', () => {
  const plan = {
    version: 1, id: 'degrees', style: 'ambient', key: 'D minor', motifs: {
      answer: [{ beat: 0, duration: 0.75, degree: 3 }],
    },
    sections: [
      { id: 'quiet', role: 'intro', chords: ['i', '@pivot'], statements: [{ track: 'melody', motif: 'answer', bar: 2 }] },
      { id: 'light', role: 'main', key: 'F major', chords: ['I', 'IV'],
        statements: [{ track: 'melody', motif: 'answer' }] },
    ],
  };
  const score = arrangeMusic(plan);
  assert.deepEqual(score.tracks.find(track => track.id === 'melody').notes.map(note => [note.beat, note.note]), [[4, 65], [8, 69]]);
  assert.equal(inspectMusic(score).modulations[0].bridge.kind, 'pivot');
  assert.throws(() => arrangeMusic({ ...plan, sections: [{ ...plan.sections[0], kay: 'D minor' }, plan.sections[1]] }),
    /Unknown field Plan\.sections\[0\]\.kay/);
  const wrong = { ...plan.sections[0], statements: [{ track: 'melody', motif: 'answer', beat: 0, bar: 1 }] };
  assert.throws(() => arrangeMusic({ ...plan, sections: [wrong, plan.sections[1]] }), /must choose beat or bar/);

  const distant = resolveHarmony([
    { id: 'start', chords: ['I', '@pivot'], path: 'first' },
    { id: 'other', key: 'F# major', chords: ['I'], path: 'other' },
  ], parseKey('C major'));
  assert.equal(distant[0].handoff.kind, 'dominant');
  assert.equal(distant[0].handoff.chord, 'C#7');
});

test('piano pedal extends the gate and clears before a same-pitch re-strike', () => {
  const base = { version: 1, id: 'pedal-check', quality: 'studio', bpm: 120, bars: 1, loop: false };
  const notes = [{ beat: 0, duration: 0.2, note: 'C4' }, { beat: 1.8, duration: 0.15, note: 'C4' }];
  const piano = { id: 'piano', instrument: 'piano', notes };
  const track = { ...piano, pedal: [[0, 1], [3, 0]] };
  const score = readMusicScore({ ...base, tracks: [track] });
  const scheduled = scheduleNotes(score.tracks[0], 48000, 24000, 4, false);
  assert.deepEqual(scheduled.map(note => note.start + note.hold), [43200, 72000]);
  const dry = renderMusic({ ...base, tracks: [piano] });
  const pedaled = renderMusic(score);
  assert.ok(dry.channels[0].subarray(28000, 33000).every(sample => sample === 0));
  assert.ok(pedaled.channels[0].subarray(28000, 33000).some(sample => Math.abs(sample) > 0.005));
  assert.throws(() => readMusicScore({ ...base, tracks: [{ ...track, instrument: 'pluck' }] }), /piano control/);

  const loop = readMusicScore({ ...base, loop: true, tracks: [{
    ...piano, notes: [{ beat: 3.5, duration: 0.25, note: 'A4' }], pedal: [[0.5, 0], [3, 1]],
  }] });
  const [tail] = scheduleNotes(loop.tracks[0], 48000, 24000, 4, true);
  assert.equal(tail.start + tail.hold, 4.5 * 24000);
});

test('piano string resonance rings with the pedal down and damps when it lifts', () => {
  const rate = 48000, framesPerBeat = 24000;
  const dry = Float32Array.from({ length: 72000 }, (_, i) => i >= 9600 && i < 14400 ? Math.sin(2 * Math.PI * 261.626 * i / rate) * 0.2 : 0);
  const tracks = [dry.slice(), dry.slice()];
  addPianoResonance(tracks, [[0, 1], [1, 0]], [60], { rate, framesPerBeat, beats: 3, loop: false });
  assert.ok(tracks[0].subarray(14700, 16600).some(value => Math.abs(value) > 0.0001));
  assert.ok(tracks[0].subarray(42000, 44000).every(value => Math.abs(value) < 0.0001));
  assert.equal(tracks[0].at(-1), 0);
});

const clip = (id, chords) => ({
  beats: chords.length * 4, frames: (chords.length * 4 + 1) * 24000, file: 'section-' + id + '.wav',
  harmony: chords.map(chord => harmonySignature(parseChord(chord))),
});
const settings = {
  version: 1, id: 'harmony-test', bpm: 120, beatsPerBar: 4, sampleRate: 48000,
  initial: 'source', states: { source: 'a', target: 'b' }, defaults: { at: 'bar', entry: 'harmonic', fadeBeats: 0.3, waitBars: 1 },
};

test('adaptive entry waits for a compatible bar and preserves the phase at the chord', () => {
  const bank = readAdaptiveBank({ ...settings, clips: { a: clip('a', ['C', 'Db', 'G']), b: clip('b', ['G', 'F']) } });
  const [initial, entry] = previewMusicTimeline(bank, [{ beat: 1, state: 'target' }], 10);
  assert.equal(entry.beat, 8);
  assert.equal(entry.offsetBeat, 0);
  assert.deepEqual(entry.handoff, { mode: 'phase', from: 'G', to: 'G' });
  assert.equal(transitionEnvelope(bank, initial, entry).overlap, 0.3);

  const remapped = readAdaptiveBank({ ...settings, clips: { a: clip('a', ['C', 'G/B', 'D']), b: clip('b', ['G/B', 'G']) } });
  const chosen = previewMusicTimeline(remapped, [{ beat: 1, state: 'target' }], 7)[1];
  assert.equal(chosen.offsetBeat, 0);
  assert.deepEqual(chosen.handoff, { mode: 'match', from: 'G/B', to: 'G/B' });
});

test('incompatible adaptive harmony releases before the cut with no chord overlap', () => {
  const bank = readAdaptiveBank({ ...settings, clips: { a: clip('a', ['C', 'G']), b: clip('b', ['F#', 'B']) } });
  const audio = new Map(Object.entries(bank.clips).map(([id, clip]) => [
    id, Array.from({ length: 2 }, () => new Float32Array(clip.frames).fill(id === 'a' ? 0.35 : -0.2)),
  ]));
  const preview = renderAdaptivePreview(bank, audio, [{ beat: 1, state: 'target' }], 7);
  const entry = preview.timeline[1];
  assert.equal(entry.frame, 96000);
  assert.equal(entry.overlapBeats, 0);
  assert.equal(entry.handoff.mode, 'release');
  assert.ok(entry.fadeBeforeBeats > 0 && entry.fadeInBeats > 0);
  assert.ok(entry.boundaryJumpDbfs < -65);
  const channel = preview.channels[0];
  assert.ok(channel[entry.frame - 100] > 0 && channel[entry.frame - 100] < 0.1);
  assert.equal(channel[entry.frame], 0);
  assert.ok(channel[entry.frame + 100] < 0 && channel[entry.frame + 100] > -0.1);
  const repeat = renderAdaptivePreview(bank, audio, [], 9).timeline[1];
  assert.equal(repeat.reason, 'repeat');
  assert.equal(repeat.overlapBeats, 0);
  assert.deepEqual(repeat.handoff, { mode: 'release', from: 'G', to: 'C' });
});
