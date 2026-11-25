import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { AdaptiveMusicDirector, previewMusicTimeline, readAdaptiveBank } from '../engine/music/adaptive.ts';
import { compileAdaptiveMusic, renderAdaptivePreview } from '../engine/music/adaptive-render.ts';
import { AdaptiveMusicPlayer } from '../engine/music/adaptive-player.ts';
import { fft } from '../engine/music/dsp.ts';
import { createVoice } from '../engine/music/instruments.ts';
import { renderMusic } from '../engine/music/render.ts';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const entry = name => fileURLToPath(new URL('../scripts/' + name, import.meta.url));
function cli(name, ...args) {
  const result = spawnSync(process.execPath, [...process.execArgv, entry(name), ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const bankData = {
  version: 1, id: 'test-bank', bpm: 120, beatsPerBar: 4, sampleRate: 48000, initial: 'quiet',
  states: { quiet: 'opening', push: 'main-part', release: 'outro' },
  clips: {
    opening: { beats: 8, frames: 201600, file: 'section-opening.wav' },
    'main-part': { beats: 16, frames: 393600, file: 'section-main-part.wav' },
    outro: { beats: 4, frames: 110400, file: 'section-outro.wav' },
  },
  transitions: [
    { from: 'quiet', to: 'push', at: 'bar', entry: 'phase', fadeBeats: 0.5 },
    { from: 'push', to: 'release', at: 'end', fadeBeats: 0.5 },
  ],
  oneShot: ['release'],
  intensity: [{ min: 0, state: 'quiet' }, { min: 0.5, state: 'push' }],
  hysteresis: 0.04,
};

test('intensity hysteresis, phase-matched transitions and ending states share one beat clock', () => {
  const bank = readAdaptiveBank(bankData);
  const timeline = previewMusicTimeline(bank, [
    { beat: 0.1, intensity: 0.2 }, { beat: 1.2, intensity: 0.58 }, { beat: 2, intensity: 0.48 },
    { beat: 4.2, intensity: 0.49 }, { beat: 5, state: 'release' },
  ], 26);
  assert.deepEqual(timeline.map(({ beat, state, offsetBeat }) => [beat, state, offsetBeat]),
    [[0, 'quiet', 0], [4, 'push', 4], [16, 'release', 0]]);

  const late = new AdaptiveMusicDirector(bank);
  assert.deepEqual(late.advance(2).map(cue => cue.beat), [0]);
  assert.ok(Math.abs(late.request('push', 1, { at: 'now' }) - 2) < 0.00001);
  assert.equal(late.advance(2).length, 0);
  assert.equal(late.advance(2.1)[0].state, 'push');
});

test('a pending ramp can be cancelled, and an exact loop boundary favors a new state', () => {
  const bank = readAdaptiveBank(bankData);
  const timeline = previewMusicTimeline(bank, [
    { beat: 0.1, state: 'push' }, { beat: 1, state: 'quiet' },
    { beat: 8, state: 'push' }, { beat: 8, state: 'quiet' },
    { beat: 9.25, state: 'push', at: 'now', entry: 'start' },
    { beat: 10, state: 'release', at: 'beat', entry: 'start' },
  ], 18);
  assert.deepEqual(timeline.map(({ beat, state, reason }) => [beat, state, reason]),
    [[0, 'quiet', 'initial'], [8, 'quiet', 'repeat'], [9.25, 'push', 'transition'], [10, 'release', 'transition']]);
  assert.throws(() => readAdaptiveBank({ ...bankData, oneShot: ['unknown'] }), /distinct known states/);
  assert.throws(() => readAdaptiveBank({ ...bankData, transitions: [{ from: 'quiet', to: 'push', at: 'bad' }] }), /at=now/);
});

test('offline transition PCM ramps the old and new clips over the same grid', () => {
  const bank = readAdaptiveBank(bankData);
  const clip = (name, value) => Array.from({ length: 2 }, () => new Float32Array(bank.clips[name].frames).fill(value));
  const clips = new Map([['opening', clip('opening', 0.35)], ['main-part', clip('main-part', -0.2)]]);
  const rendered = renderAdaptivePreview(bank, clips, [{ beat: 2.9, state: 'push' }], 7);
  const transition = rendered.timeline[1];
  assert.equal(transition.frame, 96000);
  assert.equal(transition.offsetFrame, 96000);
  assert.equal(transition.overlapBeats, 0.5);
  assert.ok(transition.boundaryJumpDbfs < -100);
  assert.ok(Math.abs(rendered.channels[0][transition.frame + 6000] - 0.075) < 1e-6);
  assert.ok(Math.abs(rendered.channels[0][transition.frame + 13000] + 0.2) < 1e-6);
});

test('changing the preview length reserves the same ending and preserves its release tail', () => {
  const score = {
    version: 1, id: 'suite', bpm: 120, bars: 2, quality: 'studio', loop: false,
    sections: [{ id: 'loop', role: 'main', bars: 1 }, { id: 'finish', role: 'outro', bars: 1 }],
    tracks: [{ id: 'piano', instrument: 'piano', reverb: 0.28, notes: [
      { beat: 0, note: 'C4', duration: 4, velocity: 0.6 },
      { beat: 4, note: 'C4', duration: 4, velocity: 0.4 },
    ] }],
  };
  const build = (beats, keepTail) => compileAdaptiveMusic({
    version: 1, id: 'dynamic', initial: 'explore', states: { explore: 'loop', leave: 'finish' },
    oneShot: ['leave'], preview: { beats, finish: 'leave', keepTail },
  }, score);
  const short = build(8, false), long = build(12, true);
  assert.equal(short.session.frames, 8 * 24000);
  assert.equal(short.session.timeline.at(-1).state, 'leave');
  assert.equal(short.session.timeline.at(-1).frame, 4 * 24000);
  assert.equal(long.session.timeline.at(-1).frame, 8 * 24000);
  assert.ok(long.session.frames > 12 * 24000);
  assert.ok(long.session.channels[0].subarray(12 * 24000, 12 * 24000 + 2000).some(value => Math.abs(value) > 0.00001));
  assert.ok(long.session.channels[0].at(-1) === 0);
});

test('a compatible chord extension allows overlap and the incoming clip retains a held note', () => {
  const score = {
    version: 1, id: 'carry', bpm: 120, bars: 2, quality: 'studio', loop: false,
    sections: [{ id: 'opening', role: 'intro', bars: 1, chords: ['Cmaj7'] },
      { id: 'answer', role: 'main', bars: 1, chords: ['C'] }],
    tracks: [{ id: 'keys', instrument: 'electric-piano', notes: [{ beat: 3, note: 'E4', duration: 2.5, velocity: 0.7 }] }],
  };
  const result = compileAdaptiveMusic({ version: 1, id: 'overlap', initial: 'a', states: { a: 'opening', b: 'answer' },
    preview: { beats: 8, changes: [{ beat: 3, state: 'b' }] } }, score);
  const transition = result.session.timeline[1];
  assert.deepEqual(transition.handoff, { mode: 'phase', from: 'Cmaj7', to: 'C', shared: true });
  assert.ok(transition.overlapBeats > 0.15);
  const [clip] = result.pcm.get('answer');
  const rms = slice => Math.sqrt(slice.reduce((sum, x) => sum + x * x, 0) / slice.length);
  assert.ok(rms(clip.subarray(0, 1200)) > 0.02);
  assert.equal(rms(clip.subarray(72000, 73000)), 0);
});

test('velocity opens the nylon and tine transients while preserving their tuned fundamentals', () => {
  const hz = 220, rate = 48000, frames = 4800;
  function magnitude(samples, frequency) {
    let real = 0, imaginary = 0;
    for (const [i, sample] of samples.entries()) {
      const phase = 2 * Math.PI * frequency * i / rate;
      real += sample * Math.cos(phase);
      imaginary += sample * Math.sin(phase);
    }
    return Math.hypot(real, imaginary);
  }
  for (const [instrument, overtone] of [['nylon-guitar', hz * 3], ['electric-piano', hz * 6.27]]) {
    const tone = velocity => {
      const voice = createVoice(instrument, rate, hz, 198, { velocity, studio: true });
      return Float32Array.from({ length: frames }, (_, i) => voice(i / rate) * Math.sin(Math.PI * i / frames) ** 2);
    };
    const soft = tone(0.22), firm = tone(0.87);
    for (const samples of [soft, firm]) {
      assert.ok(magnitude(samples, hz) > 4 * magnitude(samples, hz + 35));
      assert.ok(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) < 1));
    }
    assert.ok(magnitude(firm, overtone) / magnitude(firm, hz) > 1.25 * magnitude(soft, overtone) / magnitude(soft, hz));
  }
});

test('a studio instrument keeps the same excitation through a cropped adaptive entry', () => {
  const score = {
    version: 1, id: 'carried-seed', quality: 'studio', bpm: 120, bars: 3, loop: false, seed: 641,
    sections: [{ id: 'opening', role: 'intro', bars: 2 }, { id: 'answer', role: 'main', bars: 1 }],
    tracks: [{ id: 'air', instrument: 'pad', gainDb: -18, notes: [
      { beat: 0, duration: 1, note: 'D4' },
      { beat: 4.5, duration: 0.5, note: 'E4' },
      { beat: 7.25, duration: 2.5, note: 'A4' },
    ] }],
  };
  const standalone = renderMusic(score, { normalize: false }).channels[0];
  const routing = compileAdaptiveMusic({ version: 1, id: 'carried', initial: 'opening',
    states: { opening: 'opening', answer: 'answer' } }, score);
  const [answer] = routing.pcm.get('answer');
  const gain = 10 ** (routing.sharedGainDb / 20);
  const boundary = 8 * 24000;
  assert.ok(answer.subarray(0, 2400).some(value => Math.abs(value) > 0.02));
  for (let i = 0; i < 2400; i++) assert.ok(Math.abs(answer[i] - standalone[boundary + i] * gain) < 1e-7);
});

test('player schedules phased buffers on Web Audio time and releases its nodes', t => {
  const bank = readAdaptiveBank(bankData);
  const sources = [];
  const node = () => ({ connect(target) { return target; }, disconnect() {} });
  const context = {
    currentTime: 10,
    destination: node(),
    createGain() {
      return { ...node(), gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} } };
    },
    createBufferSource() {
      const source = { ...node(), start(time, offset) { this.started = [time, offset]; }, stop(time) { this.stopped = time; } };
      sources.push(source);
      return source;
    },
  };
  const buffers = new Map(Object.entries(bank.clips).map(([section, clip]) =>
    [section, { duration: clip.frames / bank.sampleRate }]));
  const player = new AdaptiveMusicPlayer(context, bank, buffers);
  t.after(() => player.dispose());
  player.start();
  assert.deepEqual(sources[0].started, [10.05, 0]);
  context.currentTime = 10.4;
  assert.equal(player.setState('push'), 4);
  assert.equal(sources.length, 1);
  context.currentTime = 11.96;
  player.update();
  assert.deepEqual(sources[1].started, [12.05, 2]);
  assert.equal(sources[0].stopped, 12.3);
  player.stop();
  assert.ok(sources.every(source => source.stopped !== undefined));
  player.dispose();
  assert.throws(() => player.start(), /disposed/);
});

test('the browser release path anchors both ramps on the intended musical edge', t => {
  const bank = readAdaptiveBank({
    ...bankData, defaults: { at: 'bar', entry: 'harmonic', fadeBeats: 0.35 },
    clips: {
      ...bankData.clips,
      opening: { ...bankData.clips.opening, harmony: [{ chord: 'C', bass: 0, mask: 145 }, { chord: 'G', bass: 7, mask: 2180 }] },
      'main-part': { ...bankData.clips['main-part'], harmony: Array.from({ length: 4 }, () => ({ chord: 'F#', bass: 6, mask: 1090 })) },
    },
  });
  const gains = [];
  const node = () => ({ connect(target) { return target; }, disconnect() {} });
  const context = {
    currentTime: 0, destination: node(),
    createGain() {
      const events = [];
      gains.push(events);
      return { ...node(), gain: {
        setValueAtTime(value, time) { events.push(['value', value, time]); },
        linearRampToValueAtTime(value, time) { events.push(['ramp', value, time]); },
        cancelAndHoldAtTime() {},
      } };
    },
    createBufferSource() { return { ...node(), start() {}, stop() {} }; },
  };
  const buffers = new Map(Object.entries(bank.clips).map(([section, clip]) => [section, { duration: clip.frames / bank.sampleRate }]));
  const player = new AdaptiveMusicPlayer(context, bank, buffers);
  t.after(() => player.dispose());
  player.start();
  context.currentTime = 1.982;
  assert.equal(player.setState('push', { entry: 'harmonic' }), 4);
  assert.ok(gains[1].some(([kind, value, time]) => kind === 'value' && value === 1 && Math.abs(time - 1.995) < 1e-8));
  assert.ok(gains[1].some(([kind, value, time]) => kind === 'ramp' && value === 0 && Math.abs(time - 2.05) < 1e-8));
  assert.ok(gains[2].some(([kind, value, time]) => kind === 'value' && value === 0 && Math.abs(time - 2.05) < 1e-8));
});

test('the exported adaptive bank and original catalog cues use the same game-mix preview', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'lumina-adaptive-audio-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const score = {
    version: 1, id: 'audio-source', bpm: 120, bars: 2, quality: 'studio', loop: false,
    sections: [{ id: 'opening', role: 'intro', bars: 1 }, { id: 'main-part', role: 'main', bars: 1 }],
    tracks: [{ id: 'pad', instrument: 'pad', reverb: 0.2, notes: [
      { beat: 0, duration: 4, note: 'D4' }, { beat: 4, duration: 4, note: 'F4' },
    ] }, { id: 'button', instrument: 'recipe', recipe: 'settings-tab-walnut-detent',
      notes: [{ beat: 1, duration: 0.3, note: 'hit' }, { beat: 5, duration: 0.3, note: 'hit' }] }],
  };
  const spec = {
    version: 1, id: 'bank', score: 'score.json', initial: 'idle',
    states: { idle: 'opening', active: 'main-part' },
    preview: { beats: 8, changes: [{ beat: 1, state: 'active' }] },
  };
  const dive = relative(folder, fileURLToPath(new URL('../references/scenes/dive-beneath-the-boat.json', import.meta.url)));
  const scene = { version: 1, id: 'mix', music: { score: 'routing.json' },
    sfx: [{ id: 'timer-complete-chime', atBeat: 4, duckMusicDb: 4 },
      { design: dive, atBeat: 4, alignMarker: 'layer2.entry', duckMusicDb: 2 }] };
  await Promise.all([['score.json', score], ['routing.json', spec], ['scene.json', scene]]
    .map(([name, value]) => writeFile(join(folder, name), JSON.stringify(value))));
  const inspected = cli('music.mjs', 'inspect', join(folder, 'routing.json'));
  assert.deepEqual((await readdir(folder)).sort(), ['routing.json', 'scene.json', 'score.json']);
  const bank = cli('music.mjs', 'adaptive', join(folder, 'routing.json'), '--dest', folder);
  const report = await json(bank.report);
  assert.equal(report.sources[0].recipe, 'settings-tab-walnut-detent');
  assert.deepEqual(inspected.clips, (await json(bank.manifest)).clips);
  assert.equal(inspected.preview.frames, report.frames);
  assert.deepEqual(inspected.preview.timeline, report.timeline.map(({ boundaryJumpDbfs, ...cue }) => cue));
  const mixed = cli('preview-scene.mjs', join(folder, 'scene.json'), '--dest', folder);
  const sceneReport = await json(mixed.report);
  assert.equal(report.timeline[1].frame, 96000);
  assert.deepEqual(sceneReport.music.timeline, report.timeline);
  assert.equal(sceneReport.events[0].startFrame, 96000);
  assert.equal(sceneReport.events[0].role, 'interface');
  const designed = sceneReport.events[1];
  assert.equal(designed.id, 'dive-beneath-the-boat');
  assert.equal(designed.design, dive);
  assert.ok(Math.abs(designed.startFrame / 48000 - (2 - 1.48)) < 0.03);
  assert.deepEqual(designed.marker, { name: 'layer2.entry', frame: report.timeline[1].frame });
  assert.ok(designed.credits.length > 0);
  assert.equal(sceneReport.maxDuckDb, 4);
  assert.equal((await readFile(bank.preview)).readUInt16LE(34), 24);
  assert.ok((await readFile(bank.player, 'utf8')).includes("from './adaptive.ts'"));
});

test('studio snare has a drumhead body, and low drums and cymbals occupy distinct bands', () => {
  const rate = 48000, size = 8192;
  const measure = (name, studio, seed) => {
    const voice = createVoice(name, rate, 131, seed, { velocity: 0.78, studio });
    const real = Float64Array.from({ length: size }, (_, i) =>
      voice(i / rate) * (i < 96 ? i / 96 : i > 7200 ? (size - i) / (size - 7200) : 1));
    const imaginary = new Float64Array(size);
    fft(real, imaginary);
    const band = (from, to) => {
      let total = 0;
      for (let i = Math.ceil(from * size / rate); i < Math.ceil(to * size / rate); i++) total += real[i] ** 2 + imaginary[i] ** 2;
      return total;
    };
    const total = band(5, rate / 2);
    return { lows: band(15, 150) / total, body: band(150, 900) / total, top: band(5000, rate / 2) / total };
  };
  for (const seed of [13, 71, 193]) {
    const old = measure('snare', false, seed), next = measure('snare', true, seed);
    assert.ok(next.body > 0.65 && next.top < old.top / 4);
    assert.ok(measure('low-drum', true, seed).lows > 0.8);
    assert.ok(measure('kick', true, seed).lows > 0.8);
    assert.ok(measure('tom', true, seed).lows > 0.7);
    assert.ok(measure('crash', true, seed).top > 0.5);
  }
});
