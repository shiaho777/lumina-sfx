import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { biquad, fft, hann, TAU } from '../engine/music/dsp.ts';
import { createVoice } from '../engine/music/instruments.ts';
import { performanceEnvelope } from '../engine/music/performance.ts';
import { prepareMusicRender, renderMusic } from '../engine/music/render.ts';
import { rmsDb, truePeakDb } from '../engine/music/meter.ts';
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
  assert.deepEqual(catalog.instruments.violin.range, ['G3', 'E7']);
  assert.equal(catalog.instruments.violin.dynamics, true);
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
    ['violin', 'E5'], ['electric-guitar', 'E3'], ['electric-guitar', 'E5'], ['timpani', 'D3'],
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

test('studio piano changes attack brightness with velocity and decays by register', () => {
  const rate = 48000;
  const sample = (note, velocity) => {
    const voice = createVoice('piano', rate, midiHz(noteMidi(note)), 42, { velocity, studio: true });
    return Float32Array.from({ length: rate }, (_, i) => voice(i / rate));
  };
  const brightness = signal => {
    const size = 8192;
    const real = Float64Array.from(hann(size), (weight, i) => signal[i + 480] * weight);
    const imaginary = new Float64Array(size);
    fft(real, imaginary);
    const split = Math.round(925 * size / rate);
    const energy = (start, end) => real.subarray(start, end).reduce((sum, x, i) => sum + x * x + imaginary[start + i] ** 2, 0);
    return 10 * Math.log10(energy(split, size / 2) / energy(1, split));
  };
  assert.ok(brightness(sample('C4', 0.9)) - brightness(sample('C4', 0.25)) > 2.5);
  const loss = signal => rmsDb(signal, 28800, 38400) - rmsDb(signal, 720, 4800);
  assert.ok(loss(sample('C2', 0.65)) - loss(sample('C6', 0.65)) > 10);
});

test('bowed legato overlaps adjacent pitches and leaves phrase breaks and repeated notes distinct', () => {
  const score = {
    version: 1, id: 'bowing', quality: 'studio', bpm: 120, bars: 2, loop: false,
    tracks: [{ id: 'bow', instrument: 'violin', dynamics: [[0, 0.27], [4, 0.65]], notes: [
      { beat: 0, duration: 0.97, note: 'A3' },
      { beat: 1, duration: 1, note: 'E5', articulation: 'legato' },
      { beat: 2, duration: 0.5, note: 'E5', articulation: 'legato' },
      { beat: 3, duration: 1, note: 'A4', articulation: 'legato' },
    ] }],
  };
  const { parts, rate } = prepareMusicRender(score);
  const [start, leap, repeat, phrase] = parts[0].notes;
  assert.equal(start.start + start.hold, leap.start);
  assert.equal(repeat.fromHz, undefined);
  assert.equal(phrase.fromHz, undefined);
  assert.ok(start.joinedOut && leap.joinedIn);
  const outgoing = performanceEnvelope(start, rate), incoming = performanceEnvelope(leap, rate);
  const middle = Math.round(rate * 0.014);
  const outLevel = outgoing[start.hold + middle] / outgoing[start.hold];
  assert.ok(Math.abs(outLevel ** 2 + incoming[middle] ** 2 - 1) < 0.000001);

  const pitch = midiHz(noteMidi('E5'));
  const approach = fromHz => {
    const voice = createVoice('violin', rate, pitch, 42, { velocity: 0.63, studio: true, fromHz });
    return Float64Array.from({ length: rate * 0.045 }, (_, i) => voice(i / rate));
  };
  assert.deepEqual(approach(midiHz(noteMidi('A3'))), approach(midiHz(noteMidi('G4'))));
  assert.notDeepEqual(approach(midiHz(noteMidi('A3'))), approach(undefined));
});

test('studio bow pressure brightens sustained harmonics and a fresh bow takes time to catch', () => {
  const rate = 48000;
  const hz = midiHz(noteMidi('A4'));
  const sample = (pressure, fromHz) => {
    const voice = createVoice('violin', rate, hz, 42, { velocity: 0.64, studio: true, dynamics: () => pressure, fromHz });
    return Float32Array.from({ length: rate * 0.3 }, (_, i) => voice(i / rate));
  };
  const relativeTreble = signal => {
    const filtered = signal.map(biquad('highpass', 2800, 0.72, rate));
    return rmsDb(filtered, 6240, 13920) - rmsDb(signal, 6240, 13920);
  };
  assert.ok(relativeTreble(sample(0.9)) - relativeTreble(sample(0.2)) > 4);
  const connected = sample(0.6, midiHz(noteMidi('F3')));
  assert.ok(rmsDb(connected, 384, 1344) - rmsDb(sample(0.6), 384, 1344) > 1);
});

test('rapid studio phrases retain each pitch change and re-articulate repeated notes', () => {
  for (const instrument of ['violin', 'horn']) {
    const events = ['D5', 'E5', 'F5', 'F5', 'E5', 'D5'].map((note, i) => ({
      beat: i * 0.051, duration: 0.051, note, velocity: 0.67, articulation: i === 3 ? 'accent' : 'legato',
    }));
    const score = { version: 1, id: 'rapid-phrase', quality: 'studio', bpm: 124, bars: 1, loop: false,
      tracks: [{ id: 'lead', instrument, gainDb: -12, notes: events }] };
    const { parts, rate, framesPerBeat } = prepareMusicRender(score);
    const notes = parts[0].notes;
    assert.deepEqual(notes.map(note => note.start), events.map(note => Math.round(note.beat * framesPerBeat)));
    assert.ok(notes[0].envelope.attack < 0.013);
    assert.equal(notes[2].joinedOut, 0);
    assert.equal(notes[3].joinedIn, 0);
    assert.ok(notes[2].envelope.release <= 0.012);
    for (const i of [1, 2, 4, 5]) {
      assert.ok(notes[i].joinedIn > 0 && notes[i].joinedIn <= notes[i].hold / 2);
      assert.equal(notes[i - 1].joinedOut, notes[i].joinedIn);
      assert.equal(notes[i - 1].start + notes[i - 1].hold, notes[i].start);
      assert.ok(performanceEnvelope(notes[i], rate, true)[notes[i].joinedIn] > 0.99);
    }
    let stem;
    renderMusic(score, { onStem: (_, channels) => { stem = channels[0]; } });
    for (const note of notes) assert.ok(rmsDb(stem, note.start, note.start + note.hold) > -33);
  }
});

test('studio bass drums ring in two bands and harder snare hits increase the wire response', () => {
  for (const rate of [44100, 48000]) {
    const sample = (instrument, velocity) => {
      const voice = createVoice(instrument, rate, 131, 71, { velocity, studio: true });
      return Float32Array.from({ length: Math.round(rate * 0.3) }, (_, i) => voice(i / rate));
    };
    const size = 8192;
    const drum = sample('low-drum', 0.77);
    const real = Float64Array.from(hann(size), (value, i) => value * drum[i + Math.round(rate * 0.014)]);
    const imaginary = new Float64Array(size);
    fft(real, imaginary);
    const band = (lo, hi) => {
      let energy = 0;
      for (let bin = Math.ceil(lo * size / rate); bin < Math.ceil(hi * size / rate); bin++) {
        energy += real[bin] ** 2 + imaginary[bin] ** 2;
      }
      return energy;
    };
    assert.ok(band(38, 55) > band(88, 109) * 10);
    assert.ok(band(88, 109) > band(72, 86) * 4);

    const start = Math.round(rate * 0.009), end = Math.round(rate * 0.044);
    const wireLevel = velocity => {
      const snare = sample('snare', velocity);
      const wire = snare.map(biquad('bandpass', 2900, 0.72, rate));
      assert.ok(rmsDb(wire, start, end) - rmsDb(wire, Math.round(rate * 0.23)) > 35);
      return rmsDb(wire, start, end) - rmsDb(snare, start, end);
    };
    assert.ok(wireLevel(0.92) - wireLevel(0.26) > 2);
  }
});

test('a closed studio hi-hat settles while a crash continues to radiate', () => {
  const rate = 48000;
  const decay = instrument => {
    const voice = createVoice(instrument, rate, 0, 198, { velocity: 0.76, studio: true });
    const hit = Float32Array.from({ length: rate / 3 }, (_, i) => voice(i / rate));
    return rmsDb(hit, 10800, 15000) - rmsDb(hit, 3500, 5500);
  };
  assert.ok(decay('hat') < -21);
  assert.ok(decay('crash') > -9);
});

test('studio note envelopes soften the attack and release edges at the written gate', () => {
  const { parts, rate } = prepareMusicRender({
    version: 1, id: 'smooth-envelope', quality: 'studio', bpm: 120, bars: 1, loop: false,
    tracks: [{ id: 'lead', instrument: 'chip', notes: [{ beat: 0, duration: 1, note: 'F4' }] }],
  });
  const [note] = parts[0].notes;
  const classic = performanceEnvelope(note, rate), smooth = performanceEnvelope(note, rate, true);
  assert.equal(smooth.length, classic.length);
  assert.equal(smooth[0], 0);
  assert.equal(smooth.at(-1), 0);
  assert.ok(smooth[1] < 0.2 * classic[1]);
  assert.ok(Math.abs(smooth[note.hold] - smooth[note.hold + 1]) < 0.1 * (classic[note.hold] - classic[note.hold + 1]));
});

test('studio horn joins a written change at the target pitch and preserves a fresh attack after a gap', () => {
  const score = {
    version: 1, id: 'horn-phrase', quality: 'studio', bpm: 120, bars: 1, loop: false,
    tracks: [{ id: 'horn', instrument: 'horn', notes: [
      { beat: 0, duration: 0.98, note: 'D3' },
      { beat: 1, duration: 0.95, note: 'A4', articulation: 'legato' },
      { beat: 2.5, duration: 1, note: 'F4', articulation: 'legato' },
    ] }],
  };
  const { parts, rate } = prepareMusicRender(score);
  const [opening, joined, restart] = parts[0].notes;
  assert.equal(opening.start + opening.hold, joined.start);
  assert.ok(opening.joinedOut && joined.joinedIn);
  assert.equal(restart.fromHz, undefined);
  const hz = midiHz(noteMidi('A4'));
  const attack = fromHz => {
    const voice = createVoice('horn', rate, hz, 155, { velocity: 0.63, studio: true, fromHz });
    return Float32Array.from({ length: Math.round(rate * 0.03) }, (_, i) => voice(i / rate));
  };
  assert.deepEqual(attack(146.83), attack(392));
  assert.ok(rmsDb(attack(146.83)) - rmsDb(attack(undefined)) > 3);
});

test('studio guitar muting damps the string on both guitar models', () => {
  const rate = 48000;
  const hz = midiHz(noteMidi('E3'));
  for (const instrument of ['nylon-guitar', 'electric-guitar']) {
    const sustain = articulation => {
      const voice = createVoice(instrument, rate, hz, 237, { velocity: 0.72, studio: true, articulation });
      const note = Float32Array.from({ length: rate / 4 }, (_, i) => voice(i / rate));
      return rmsDb(note, 7000, 10800);
    };
    assert.ok(sustain('sustain') - sustain('mute') > 10, instrument);
  }
});

test('studio electric guitar sends chords through one nonlinear amplifier before applying track gain', () => {
  const base = { version: 1, id: 'shared-guitar-amp', quality: 'studio', bpm: 120, bars: 1, loop: false };
  const notes = ['E3', 'G#3'].map(note => ({ beat: 0, duration: 1.7, note, velocity: 0.74 }));
  const synth = (events, gainDb) => {
    let pcm;
    renderMusic({ ...base, tracks: [{ id: 'guitar', instrument: 'electric-guitar', notes: events, gainDb }] },
      { onStem: (_, channels) => { pcm = channels[0]; } });
    return pcm;
  };
  const mixed = synth(notes, -12);
  const separate = notes.map(note => synth([note], -12));
  const crossTone = notes.reduce((hz, event) => hz + midiHz(noteMidi(event.note)), 0);
  const amplitude = samples => {
    const window = hann(8192);
    let real = 0, imaginary = 0;
    for (let i = 0; i < window.length; i++) {
      const value = window[i] * samples[6000 + i];
      const phase = TAU * crossTone * i / 48000;
      real += value * Math.cos(phase);
      imaginary += value * Math.sin(phase);
    }
    return Math.hypot(real, imaginary);
  };
  assert.ok(amplitude(mixed) > 20 * (amplitude(separate[0]) + amplitude(separate[1])));
  const quietlyMixed = synth(notes, -18);
  assert.ok(Math.abs(rmsDb(mixed, 6000, 14000) - rmsDb(quietlyMixed, 6000, 14000) - 6) < 0.0001);
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
