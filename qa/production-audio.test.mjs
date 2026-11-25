import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readAudioPreview, renderAudioPreview } from '../engine/project-mix.ts';
import { readAutomation } from '../engine/music/automation.ts';
import { TAU } from '../engine/music/dsp.ts';
import { measureLoudness } from '../engine/music/meter.ts';
import { arrangeMusic } from '../engine/music/plan.ts';
import { renderMusic } from '../engine/music/render.ts';
import { encodeWav } from '../engine/wav.ts';
import { loadRecipes } from '../scripts/recipes.mjs';

const path = relative => fileURLToPath(new URL(relative, import.meta.url));
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const call = (script, ...args) => {
  const result = spawnSync(process.execPath, [...process.execArgv, path('../scripts/' + script), ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

function readPcm(wav) {
  const depth = wav.readUInt16LE(34), rate = wav.readUInt32LE(24), count = wav.readUInt16LE(22);
  const stride = wav.readUInt16LE(32);
  const channels = Array.from({ length: count }, (_, ch) => Float32Array.from({
    length: wav.readUInt32LE(40) / stride,
  }, (_, i) => {
    const value = wav.readIntLE(44 + i * stride + ch * (depth / 8), depth / 8);
    return value / (2 ** (depth - 1) - Number(value >= 0));
  }));
  return { depth, rate, channels };
}

test('shared PCM encoder preserves 16-bit output and creates correctly padded signed 24-bit WAV', () => {
  const samples = Float32Array.from([-1, 0, 1]);
  const original = Buffer.from(encodeWav(samples));
  assert.deepEqual(Array.from(original.subarray(44)), [0, 128, 0, 0, 255, 127]);
  const wide = Buffer.from(encodeWav(samples, 48000, { bits: 24 }));
  assert.equal(wide.length, 54);
  assert.equal(wide.readUInt32LE(4), 46);
  assert.equal(wide.readUInt32LE(40), 9);
  assert.deepEqual(Array.from(readPcm(wide).channels[0]), [-1, 0, 1]);
  const options = { bits: 24, ditherSeed: 89 };
  assert.deepEqual(encodeWav(samples, 48000, options), encodeWav(samples, 48000, options));
});

test('dynamics changes horn spectra while expression is a linear gain lane', () => {
  const rate = 48000, hertz = 220;
  const base = { version: 1, id: 'curves', bpm: 120, bars: 2, loop: false, quality: 'studio' };
  const stem = changes => {
    let pcm;
    renderMusic({
      ...base, tracks: [{ id: 'horn', instrument: 'horn', notes: [{ beat: 0, duration: 6, note: 'A3', velocity: 0.56 }], ...changes }],
    }, { onStem: (_, channels) => { pcm = channels[0]; } });
    return pcm;
  };
  const flat = stem({}), quarter = stem({ expression: [[0, 0.25]] });
  assert.ok(flat.subarray(2000, 3000).some(value => value !== 0));
  assert.ok(flat.every((value, i) => Math.abs(quarter[i] - value * 0.25) < 1e-7));
  const played = stem({ dynamics: [[0, 0.05], [2, 0.05], [3, 0.94], [6, 0.94]] });
  const amplitude = (start, hz) => {
    let real = 0, imaginary = 0;
    const frames = 4800;
    for (let i = 0; i < frames; i++) {
      const value = played[start + i] * (0.5 - 0.5 * Math.cos(TAU * i / frames));
      real += value * Math.cos(TAU * hz * i / rate);
      imaginary += value * Math.sin(TAU * hz * i / rate);
    }
    return Math.hypot(real, imaginary);
  };
  const first = amplitude(16000, hertz * 2) / amplitude(16000, hertz);
  const second = amplitude(96000, hertz * 2) / amplitude(96000, hertz);
  assert.ok(second > first * 1.8, 'higher pressure increases relative second-harmonic energy');
  const loopCurve = readAutomation([[1, 0.2], [3, 0.6]], 4, true);
  assert.equal(loopCurve(0), loopCurve(4));
  assert.ok(Math.abs(loopCurve(0) - 0.4) < 1e-9);
  assert.throws(() => renderMusic({ ...base, loop: true, tracks: [
    { id: 'pad', instrument: 'pad', notes: [], expression: [[0, 1], [8, 0]] },
  ] }), /matching values at beat zero/);
});

test('a plan preserves the written motif, transposes the return and exports editable studio assets', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lumina-production-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path('../references/music/observatory-plan.json');
  const plan = await json(file);
  const generated = arrangeMusic(plan);
  const piano = generated.tracks.find(track => track.id === 'piano');
  const horn = generated.tracks.find(track => track.id === 'horn');
  assert.deepEqual(piano.notes.filter(note => note.beat < 8).map(note => note.note), [72, 75, 77, 80, 77, 75]);
  assert.deepEqual(horn.notes.filter(note => note.beat >= 8 && note.beat < 16).map(note => note.note), ['C4', 'Eb4', 'F4', 'Ab4', 'F4', 'Eb4']);
  assert.equal(generated.tracks.find(track => track.id === 'guitar').notes.filter(note => note.beat < 32).length, 0);
  assert.equal(generated.sections[3].id, 'return');
  const inspection = call('music.mjs', 'inspect', file);
  assert.equal(inspection.statements.filter(repeat => repeat.motif === 'signal').length, 3);
  assert.ok(inspection.tracks.some(track => track.id === 'horn' && track.dynamics > 0));
  const output = call('music.mjs', 'arrange', file, '--dest', directory, '--no-stems');
  const wav = readPcm(await readFile(output.master));
  assert.equal(wav.depth, 24);
  assert.equal(wav.rate, 48000);
  assert.equal(wav.channels.length, 2);
  assert.equal((await json(output.plan)).motifs.signal.length, 6);
  const original = await json(output.report);
  const repeated = call('music.mjs', 'render', output.score, '--dest', join(directory, 'repeat'), '--no-stems');
  assert.equal((await json(repeated.report)).files.master.sha256, original.files.master.sha256);
  const classic = call('music.mjs', 'render', output.score, '--quality', 'classic', '--id', 'classic-check',
    '--dest', directory, '--no-stems');
  assert.equal(readPcm(await readFile(classic.master)).rate, 44100);
  assert.equal(readPcm(await readFile(classic.master)).depth, 16);
  const desk = call('audition.mjs', output.plan, classic.score, '--at', '8', '--out', join(directory, 'compare.html'));
  assert.equal(desk.takes, 1);
  const html = await readFile(desk.file, 'utf8');
  const payload = JSON.parse(html.match(/id="audio-data"[^>]*>(.*?)<\/script>/s)[1]);
  const values = payload.choices.map(choice => {
    const { channels, rate } = readPcm(Buffer.from(choice.takes[0], 'base64'));
    return measureLoudness(channels, rate).integrated;
  });
  assert.ok(Math.abs(values[0] - values[1]) < 0.1, 'audition level is matched after encoding');
  const named = call('music.mjs', 'compose', '--form', 'opening=intro:1,return=main:1', '--id', 'named-form',
    '--dest', directory, '--no-stems');
  assert.deepEqual((await json(named.report)).sections.map(section => section.id), ['opening', 'return']);
  const help = spawnSync(process.execPath, [...process.execArgv, path('../scripts/music.mjs'), 'arrange', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /"sections".*"id":"opening"/);
});

test('a puzzle loop can reprioritize tracks and preserve a motif handoff without editing generated events', () => {
  const draft = {
    version: 1, id: 'puzzle', style: 'cinematic', bpm: 120, key: 'D minor', loop: true,
    motifs: { clue: [{ beat: 0, duration: 0.85, note: 'D4' }, { beat: 1, duration: 0.85, note: 'F4' }] },
    sections: [
      { id: 'opening', role: 'intro', chords: ['Dm', 'Bb', 'Dm', 'A'],
        mute: ['percussion', 'timpani'], statements: [{ track: 'piano', motif: 'clue' }] },
      { id: 'return', role: 'main', chords: ['Dm', 'Bb', 'Gm', 'A'],
        mute: ['percussion'], statements: [{ track: 'cello', motif: 'clue', transpose: -12 }] },
    ],
  };
  const written = arrangeMusic(draft);
  assert.deepEqual(written.tracks.find(track => track.id === 'cello').notes.filter(note => note.beat >= 16)
    .map(({ beat, note }) => [beat, note]), [[16, 50], [17, 53]]);
  assert.throws(() => arrangeMusic({ ...draft, sections: [{ ...draft.sections[0], chords: ['Dm'], statements: [
    { track: 'piano', motif: 'clue', beat: 3.75 },
  ] }] }), /extends beyond its section/);
  const rendered = renderMusic(written);
  assert.equal(rendered.report.loop.endFrame, 16 * 48000);
  assert.ok(rendered.report.master.truePeakDbtp <= -1);
});

test('scene previews use catalog roles and exact beat timing, and duck the music bus on the event', async () => {
  const recipes = await loadRecipes(new Set(['timer-complete-chime']));
  const catalog = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const score = {
    version: 1, id: 'test-bed', quality: 'studio', bpm: 120, bars: 2, loop: false,
    tracks: [{ id: 'pad', instrument: 'pad', notes: [{ beat: 0, duration: 8, note: 'C4' }] }],
  };
  const preview = {
    version: 1, id: 'game-preview', durationSec: 4, music: { score: 'score.json', gainDb: -6 },
    sfx: [{ id: 'timer-complete-chime', atBeat: 4 }],
  };
  assert.throws(() => readAudioPreview({ ...preview, sfx: [{ ...preview.sfx[0], design: 'mix.json' }] }), /one catalog id or design/);
  const missingMarker = readAudioPreview({ ...preview, sfx: [{ ...preview.sfx[0], alignMarker: 'absent-marker' }] });
  assert.throws(() => renderAudioPreview(missingMarker, score, catalog), /has no marker absent-marker/);
  const dry = renderAudioPreview(readAudioPreview(preview), score, catalog);
  const wet = renderAudioPreview(readAudioPreview({ ...preview, sfx: [{ ...preview.sfx[0], duckMusicDb: 6 }] }), score, catalog);
  assert.deepEqual(dry.sfxBus, wet.sfxBus);
  const event = wet.report.events[0];
  assert.equal(event.startFrame, 96000);
  assert.equal(event.role, 'interface');
  assert.equal(wet.report.maxDuckDb, 6);
  const window = wet.musicBus[0].subarray(96100, 97100);
  assert.ok(window.some(value => Math.abs(value) > 0.01));
  for (let i = 0; i < window.length; i++) {
    assert.ok(Math.abs(window[i] - dry.musicBus[0][96100 + i] * 10 ** (-6 / 20)) < 1e-7);
  }
  assert.ok(wet.report.master.truePeakDbtp <= -1);
});

test('a scene marker stays on its target sample after the recipe renderer trims the start', () => {
  const recipe = {
    id: 'delayed-contact', name: 'Delayed contact', category: 'Impacts', tags: [],
    loopable: false, durationSec: 0.4, params: {}, markers: { contact: 0.25 },
    render({ frames, sampleRate }) {
      const samples = new Float32Array(frames);
      const contact = Math.round(sampleRate * 0.25);
      for (let i = contact; i < frames; i++) samples[i] = Math.exp(-(i - contact) / 1200) * 0.5;
      return samples;
    },
  };
  const preview = readAudioPreview({ version: 1, id: 'sync-check', durationSec: 1,
    sfx: [{ id: recipe.id, atSec: 0.5, alignMarker: 'contact' }] });
  const { report, sfxBus } = renderAudioPreview(preview, undefined, new Map([[recipe.id, recipe]]));
  assert.deepEqual(report.events[0].marker, { name: 'contact', frame: 24000 });
  assert.equal(report.events[0].startFrame, 23990);
  assert.equal(sfxBus[0][23999], 0);
  assert.ok(sfxBus[0][24000] > 0.015);
});

test('recipe parts keep the catalog source and gate pitched notes and one-shots on the music clock', () => {
  const tone = {
    id: 'tone', name: 'Tone', category: 'Sci-Fi & UI', tags: [], loopable: false, durationSec: 0.35, params: {},
    render({ frames, sampleRate }) {
      return Float32Array.from({ length: frames }, (_, i) => Math.sin(2 * Math.PI * 440 * i / sampleRate));
    },
  };
  const plan = {
    version: 1, id: 'recipe-test', backing: false, style: 'menu', bpm: 120,
    parts: { pitched: { instrument: 'recipe', recipe: 'tone', root: 'A4' }, raw: { instrument: 'recipe', recipe: 'tone' } },
    motifs: {
      tune: [{ beat: 0, duration: 0.5, note: 'A4' }, { beat: 1, duration: 0.5, note: 'A5' }],
      tap: [{ beat: 0.5, duration: 0.2, note: 'hit' }],
    },
    sections: [{ id: 'phrase', role: 'main', chords: ['A'],
      statements: [{ track: 'pitched', motif: 'tune' }, { track: 'raw', motif: 'tap' }] }],
  };
  const score = arrangeMusic(plan);
  assert.deepEqual(score.tracks.map(track => track.id), ['pitched', 'raw']);
  assert.throws(() => renderMusic(score), /needs the catalog recipe tone/);
  const recipes = new Map([['tone', tone]]);
  const stems = new Map();
  const { report } = renderMusic(score, { recipes, onStem: (id, pcm) => stems.set(id, pcm[0]) });
  assert.deepEqual(report.tracks.map(track => track.source.recipe), ['tone', 'tone']);
  const cycles = (samples, at) => {
    let count = 0;
    for (let frame = at + 1; frame < at + 4800; frame++) if (samples[frame - 1] <= 0 && samples[frame] > 0) count++;
    return count;
  };
  assert.ok(Math.abs(cycles(stems.get('pitched'), 1500) - 44) <= 2);
  assert.ok(Math.abs(cycles(stems.get('pitched'), 25500) - 88) <= 3);
  assert.ok(stems.get('raw').subarray(12000, 16800).some(value => Math.abs(value) > 0.01));
  assert.ok(stems.get('raw').subarray(16800).every(value => value === 0));
  const invalid = { ...score, tracks: [{ ...score.tracks[0], notes: [{ beat: 0, note: 'A7', duration: 0.5 }] }] };
  assert.throws(() => renderMusic(invalid, { recipes }), /recipe pitch range/);
});
