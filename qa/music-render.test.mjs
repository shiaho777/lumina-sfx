import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fft, hann } from '../engine/music/dsp.ts';
import { createVoice } from '../engine/music/instruments.ts';
import { renderMusic } from '../engine/music/render.ts';
import { truePeakDb } from '../engine/music/meter.ts';
import { midiHz, noteMidi } from '../engine/music/theory.ts';

const script = fileURLToPath(new URL('../scripts/music.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [...process.execArgv, script, ...args], { encoding: 'utf8' });
const music = (...args) => {
  const result = run(...args);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
const json = async path => JSON.parse(await readFile(path, 'utf8'));

test('the CLI composes, reproduces and revises a seamless four-track loop', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'lumina-music-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const first = music('compose', '--bars', '2', '--seed', '42', '--dest', temp);
  assert.deepEqual(music('compose', '--bars', '2', '--seed', '42', '--dest', temp), first);
  const score = await json(first.score);
  const report = await json(first.report);
  assert.equal(report.frames, Math.round(8 * 60 * 44100 / 104));
  assert.equal(report.loop.endFrame, report.frames);
  assert.ok(report.loop.boundaryJumpDbfs < -40);
  assert.ok(Math.abs(report.master.integratedLufs - (-18)) < 0.1);
  assert.ok(report.master.truePeakDbtp <= -1);
  assert.equal(first.stems.length, 4);

  for (const path of [first.master, ...first.stems]) {
    const wav = await readFile(path);
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), 44100);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.readUInt32LE(40), report.frames * 4);
  }
  const rebuilt = music('render', first.score, '--dest', join(temp, 'rebuild'));
  assert.deepEqual(await readFile(rebuilt.master), await readFile(first.master));
  assert.deepEqual(await json(rebuilt.report), report);

  score.tracks.find(track => track.id === 'melody').notes[0].note = 'A5';
  const revisedFile = join(temp, 'revised.json');
  await writeFile(revisedFile, JSON.stringify(score));
  const collision = run('render', revisedFile, '--dest', temp);
  assert.equal(collision.status, 1);
  assert.match(collision.stderr, /already exists with different files/);
  assert.deepEqual(await json(first.report), report);
  assert.ok((await readdir(temp)).every(file => !file.startsWith('.lumina-music-')));

  const second = music('render', revisedFile, '--id', 'menu-v2', '--dest', temp);
  const revision = await json(second.report);
  assert.notEqual(revision.files.master.sha256, report.files.master.sha256);
  for (const stem of revision.files.stems) {
    const previous = report.files.stems.find(file => file.id === stem.id);
    if (stem.id === 'melody') assert.notEqual(stem.sha256, previous.sha256);
    else assert.equal(stem.sha256, previous.sha256);
  }
});

test('the CLI reports section timing and renders a one-shot with a release tail', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'lumina-music-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const project = music('compose', '--style', 'arcade', '--form', 'intro:1,main:2,break:1,outro:1',
    '--one-shot', '--no-stems', '--dest', temp);
  const score = await json(project.score);
  const report = await json(project.report);
  assert.equal(score.tracks.find(track => track.id === 'melody').instrument, 'chip');
  assert.equal(report.loop, null);
  assert.deepEqual(project.stems, []);
  assert.deepEqual(report.sections.map(({ role, startBar, bars }) => [role, startBar, bars]),
    [['intro', 1, 1], ['main', 2, 2], ['break', 4, 1], ['outro', 5, 1]]);
  assert.ok(report.sections[0].rmsDbfs < report.sections[1].rmsDbfs);
  assert.ok(report.sections[1].startFrame === report.sections[0].endFrame);
  assert.ok(report.frames > report.sections.at(-1).endFrame);
});

test('release wraps only in loops, linear renders keep the intro, and mastering honors its ceiling', () => {
  const score = {
    version: 1, id: 'tail', bpm: 240, bars: 1, beatsPerBar: 4, loop: false,
    master: { targetLufs: -8, ceilingDbtp: -8 },
    tracks: [{ id: 'pad', instrument: 'pad', gainDb: 12, notes: [{ beat: 2, duration: 2, note: 'C4', velocity: 1 }] }],
  };
  const linear = renderMusic(score), loop = renderMusic({ ...score, loop: true });
  assert.equal(loop.report.frames, 44100);
  assert.ok(linear.report.frames > 44100);
  assert.ok(linear.channels[0].subarray(0, 22050).every(x => x === 0));
  assert.ok(linear.channels[0].subarray(44100).some(x => Math.abs(x) > 0.01));
  assert.ok(loop.channels[0].subarray(0, 1000).some(x => Math.abs(x) > 0.01));
  assert.ok(linear.report.master.truePeakDbtp <= -8);
  assert.ok(truePeakDb(linear.channels) <= -8);
  assert.throws(() => renderMusic({ ...score, tracks: [{ ...score.tracks[0], notes: [{ beat: 4, duration: 1, note: 'C4' }] }] }),
    /must start before the end/);
});

test('cinematic instruments are discoverable, and the normal CLI renders each stem', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'lumina-cinematic-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const catalog = music('instruments');
  assert.ok(catalog.instruments.strings.articulations.includes('swell'));
  assert.ok(catalog.instruments['electric-guitar'].articulations.includes('mute'));
  assert.ok(catalog.drumSounds.includes('crash'));

  const cue = music('compose', '--style', 'cinematic', '--form', 'intro:2,main:2,break:1,main:2,outro:1',
    '--one-shot', '--seed', '51431', '--dest', temp);
  const score = await json(cue.score);
  const report = await json(cue.report);
  assert.equal(score.room, 'hall');
  assert.deepEqual(new Set(score.tracks.map(track => track.instrument)),
    new Set(['piano', 'strings', 'cello', 'horn', 'electric-guitar', 'timpani', 'drums', 'bass']));
  assert.equal(cue.stems.length, 9);
  assert.ok(report.tracks.every(track => track.notes > 0 && track.rmsDbfs > -70));
  assert.ok(report.sections[1].rmsDbfs > report.sections[0].rmsDbfs + 3);
  assert.ok(report.frames > report.sections.at(-1).endFrame);
  assert.ok(report.master.truePeakDbtp <= -1);
  const rebuilt = music('render', cue.score, '--dest', join(temp, 'rebuild'));
  assert.deepEqual((await json(rebuilt.report)).files, report.files);
});

test('orchestral voices carry the requested fundamental across their playable registers', () => {
  const rate = 44100, size = 32768, window = hann(size);
  for (const [instrument, note] of [
    ['piano', 'C4'], ['strings', 'A4'], ['cello', 'C3'], ['horn', 'F3'],
    ['electric-guitar', 'E3'], ['electric-guitar', 'E5'], ['timpani', 'D3'],
  ]) {
    const hz = midiHz(noteMidi(note));
    const oscillator = createVoice(instrument, rate, hz, 123, { velocity: 0.67 });
    const real = Float64Array.from(window, (weight, i) => weight * oscillator(i / rate));
    const imaginary = new Float64Array(size);
    fft(real, imaginary);
    const level = i => Math.hypot(real[i], imaginary[i]);
    const first = Math.round(0.9 * hz * size / rate), last = Math.round(1.1 * hz * size / rate);
    let bin = first;
    for (let i = first + 1; i <= last; i++) if (level(i) > level(bin)) bin = i;
    const left = Math.log(level(bin - 1)), center = Math.log(level(bin)), right = Math.log(level(bin + 1));
    const actual = (bin + (left - right) / (2 * (left - 2 * center + right))) * rate / size;
    assert.ok(Math.abs(1200 * Math.log2(actual / hz)) < 22, instrument + ' fundamental is in tune');
    assert.ok(level(bin) / size > 0.02, instrument + ' has substantial fundamental energy');
  }
});

test('articulations affect note shape and room tails preserve both linear and loop timing', () => {
  const base = { version: 1, id: 'performance', bpm: 240, bars: 1, loop: false };
  const events = { beat: 0, duration: 3, note: 'A3' };
  const stemFor = (instrument, articulation) => {
    let stem;
    renderMusic({ ...base, tracks: [{ id: 'voice', instrument, notes: [{ ...events, articulation }] }] },
      { onStem: (_id, channels) => { stem = channels[0]; } });
    return stem;
  };
  const energy = (samples, start, end) => samples.subarray(start, end).reduce((sum, value) => sum + value * value, 0);
  const bowed = stemFor('strings', 'sustain'), short = stemFor('strings', 'short'), swell = stemFor('strings', 'swell');
  assert.ok(energy(bowed, 16000, 21000) > 1);
  assert.equal(energy(short, 16000, 21000), 0);
  assert.ok(energy(swell, 2000, 6000) < 0.10 * energy(bowed, 2000, 6000));
  assert.ok(energy(swell, 21000, 25000) > 6 * energy(swell, 2000, 6000));
  assert.ok(energy(stemFor('electric-guitar', 'sustain'), 14000, 18000) > 1);
  assert.equal(energy(stemFor('electric-guitar', 'mute'), 14000, 18000), 0);
  assert.throws(() => stemFor('piano', 'mute'), /articulation for piano/);

  const track = { id: 'horn', instrument: 'horn', notes: [{ beat: 2.50, duration: 0.62, note: 'F3', articulation: 'short' }] };
  const dry = renderMusic({ ...base, loop: true, tracks: [track] });
  const wetTrack = { ...track, reverb: 0.6 };
  const wrapped = renderMusic({ ...base, loop: true, tracks: [wetTrack] });
  const linear = renderMusic({ ...base, tracks: [wetTrack] });
  assert.equal(wrapped.report.frames, dry.report.frames);
  assert.equal(energy(dry.channels[0], 0, 6000), 0);
  assert.ok(energy(wrapped.channels[0], 0, 6000) > 1e-6);
  assert.equal(energy(linear.channels[0], 0, 6000), 0);
  assert.ok(linear.report.frames > dry.report.frames);
  assert.ok(energy(linear.channels[0], 44100, 53000) > 1e-6);
  assert.ok(linear.channels.every(channel => channel.at(-1) === 0));
});
