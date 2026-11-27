import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { encodeWav } from '../engine/wav.ts';
import { renderSound, SAMPLE_RATE } from '../engine/render.ts';
import mouse from '../recipes/desktop-mouse-press.ts';
import { ffmpegPath } from '../scripts/audio-export.mjs';
import { auditDelivery, probeStereo } from '../scripts/edit-delivery.mjs';
import { measureTrack } from '../scripts/edit-track.mjs';
import { scoreGain } from '../scripts/edit-context.mjs';
import { mixPicture } from '../scripts/edit-media.mjs';

test('plain-language scoring reuses an existing wide click across a cut and respects device and family boundaries', async (t) => {
  if (spawnSync(ffmpegPath(), ['-version']).error?.code === 'ENOENT') return t.skip('FFmpeg required');
  const dir = await mkdtemp(join(tmpdir(), 'lumina-wide-contact-'));
  try {
    const path = name => join(dir, name);
    const take = renderSound(mouse);
    const left = new Float32Array(3 * SAMPLE_RATE), right = new Float32Array(left.length);
    // In the reference both channels agree. In later shots the contact lives in the stereo difference.
    for (const frame of [12, 24, 36, 48]) {
      const start = Math.round(frame * SAMPLE_RATE / 24);
      for (let i = 0; i < take.length; i++) {
        left[start + i] = take[i] * 0.13;
        right[start + i] = take[i] * (frame === 12 ? 0.13 : -0.10);
      }
    }
    await writeFile(path('source.wav'), Buffer.from(encodeWav([left, right])));
    const capture = spawnSync(ffmpegPath(), ['-v', 'error', '-i', path('source.wav'),
      '-c:a', 'aac', '-b:a', '192k', path('recorded.m4a')]);
    assert.equal(capture.status, 0, capture.stderr.toString());
    const input = {
      id: 'wide-source', fps: 24, durationFrames: 72, device: 'mouse',
      events: [
        { id: 'known', frame: 12, action: 'press', sourceContact: true },
        { id: 'same', frame: 24, brief: 'a mouse press' },
        { id: 'other-device', frame: 36, brief: 'a trackpad press' },
        { id: 'other-switch', frame: 48, brief: 'a mouse press', family: 'second-switch' },
        { id: 'missing', frame: 60, brief: 'a mouse press' },
      ],
    };
    await writeFile(path('events.json'), JSON.stringify(input));
    const run = spawnSync(process.execPath, [
      '--experimental-strip-types', '--disable-warning=ExperimentalWarning',
      fileURLToPath(new URL('../scripts/score-edit.mjs', import.meta.url)), 'plan', path('events.json'),
      '--source', path('recorded.m4a'), '--out', path('plan.json'),
    ], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const { cues } = JSON.parse(await readFile(path('plan.json'), 'utf8'));
    assert.deepEqual(cues.map(c => c.decision), ['reuse', 'reuse', 'review', 'review', 'play']);
    assert.equal(cues[1].sourceEvidence[0].matches, 'known');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('decoded delivery audit finds a missing added stem, original clipping pressure and a mono cancellation', async (t) => {
  const ff = ffmpegPath(),
    available = spawnSync(ff, ['-version']);
  if (available.error?.code === 'ENOENT') return t.skip('FFmpeg required for picture delivery');
  const tmp = await mkdtemp(join(tmpdir(), 'lumina-delivery-'));
  const file = (name) => join(tmp, name);
  const encode = (...args) => {
    const r = spawnSync(ff, ['-v', 'error', '-nostdin', ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  try {
    encode(
      '-f',
      'lavfi',
      '-i',
      'color=size=48x48:rate=24:duration=1',
      '-f',
      'lavfi',
      '-i',
      'aevalsrc=0.985*sin(2*PI*440*t)|-0.985*sin(2*PI*440*t):s=48000:d=1',
      '-c:v',
      'libx264',
      '-c:a',
      'alac',
      file('source.mp4'),
    );
    encode(
      '-f',
      'lavfi',
      '-i',
      'aevalsrc=0.14*sin(2*PI*710*t)*between(t\\,0.49\\,0.7)|0.14*sin(2*PI*710*t)*between(t\\,0.49\\,0.7):s=48000:d=1',
      '-c:a',
      'pcm_s16le',
      file('stem.wav'),
    );
    const delivery = await mixPicture(file('source.mp4'), file('stem.wav'), file('finished.mp4'));
    const plan = {
      id: 'probe',
      fps: 24,
      durationFrames: 24,
      cues: [{ id: 'sync', decision: 'play', syncFrame: 12 }],
    };
    const audit = (p) => auditDelivery(plan, file('source.mp4'), file('stem.wav'), file(p));
    const good = await audit('finished.mp4'),
      missing = await audit('source.mp4');
    assert.ok(delivery.truePeakDbtp <= -0.5 && delivery.deliveryTrimDb < 0);
    assert.ok(
      good.mixPeakDbfs < 0 && Math.abs(good.originalGainDb - delivery.deliveryTrimDb) < 0.5,
      JSON.stringify(good),
    );
    assert.ok(good.cues[0].addedGainDb === null || good.cues[0].addedGainDb < -1);
    assert.ok(good.cues[0].monoPhoneMixDbfs !== null && good.cues[0].monoPhoneMixDbfs < -25);
    assert.ok(missing.cues[0].warnings.length);
    assert.ok((missing.cues[0].monoPhoneMixDbfs ?? -Infinity) < -130);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});


test('the delivered stereo probe distinguishes left, silent, right and antiphase mono cancellation', async (t) => {
  const ff = ffmpegPath();
  if (spawnSync(ff, ['-version']).error?.code === 'ENOENT') return t.skip('FFmpeg required for stereo probes');
  const dir = await mkdtemp(join(tmpdir(), 'lumina-pan-'));
  try {
    const file = join(dir, 'orbit.wav');
    const l = '0.25*sin(2*PI*720*t)*(lt(t,0.2)+gte(t,0.7))';
    const r = '0.25*sin(2*PI*720*t)*(between(t,0.4,0.6)-gte(t,0.7))';
    const expression = "aevalsrc=exprs='" + l + "|" + r + "':s=48000:d=1";
    const made = spawnSync(ff, ['-v','error','-f','lavfi','-i',expression,'-c:a','pcm_s16le',file]);
    assert.equal(made.status, 0, made.stderr.toString());
    const { windows } = await probeStereo(file, [0.03,0.25,0.42,0.8], 70);
    assert.deepEqual(windows.map(w=>w.side), ['left','quiet','right','center']);
    assert.ok(windows[3].stereoRmsDbfs > -20 && (windows[3].monoRmsDbfs ?? -Infinity) < -90);
    await assert.rejects(probeStereo(file,[1.2]),/outside/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('a key under a bright speech segment leaves space without dimming adjacent equal-level keys', async (t) => {
  const ff = ffmpegPath();
  if (spawnSync(ff, ['-version']).error?.code === 'ENOENT') return t.skip('FFmpeg required');
  const dir = await mkdtemp(join(tmpdir(), 'lumina-speech-'));
  try {
    const file = join(dir, 'contrast.wav');
    const expr = '0.08*sin(2*PI*if(lt(t,0.5),200,3100)*t)';
    const made = spawnSync(ff, ['-v','error','-f','lavfi','-i', "aevalsrc=exprs='" + expr + "|-" + expr + "':s=48000:d=1",file]);
    assert.equal(made.status, 0, made.stderr.toString());
    const track = await measureTrack(file);
    const at = (f, speech) => scoreGain(-4, 'laptop-scissor-keyboard-key-down', f, 30, 'normal', speech, track);
    assert.ok(at(21,true) < at(6,true) - 3.5);
    assert.ok(Math.abs(at(21,false) - at(6,false)) < 0.1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a second recorded attack is flagged on a single mouse press and allowed for two observed contacts', async (t) => {
  const ff = ffmpegPath();
  if (spawnSync(ff, ['-version']).error?.code === 'ENOENT') return t.skip('FFmpeg required for this picture test');
  const dir = await mkdtemp(join(tmpdir(), 'lumina-two-attacks-'));
  const file = name => join(dir, name);
  const tone = (time, level) => "aevalsrc='sin(2*PI*900*t)*" + level + "*between(t," + time + "," + (time + 0.012) + ")':s=48000:d=1";
  function encode(...args) {
    const run = spawnSync(ff, ['-v', 'error', '-nostdin', ...args]);
    assert.equal(run.status, 0, run.stderr.toString());
  }
  try {
    encode('-f','lavfi','-i','color=size=48x48:rate=25:duration=1','-f','lavfi','-i',tone(0.52,0.21),
      '-c:v','libx264','-c:a','aac',file('source.mp4'));
    encode('-f','lavfi','-i',tone(0.4,0.25),'-c:a','pcm_s16le',file('press.wav'));
    await mixPicture(file('source.mp4'),file('press.wav'),file('cut.mp4'));
    const press = {id:'tap', decision:'play', signature:'press/mouse', soundId:'desktop-mouse-press', syncFrame:10};
    const plan = {id:'switch',fps:25,durationFrames:25,cues:[press]};
    const audit = () => auditDelivery(plan,file('source.mp4'),file('press.wav'),file('cut.mp4'));
    const result = await audit();
    assert.equal(result.cues[0].secondAttack.source,'original');
    assert.equal(result.cues[0].secondAttack.separationMs,120);
    plan.cues.push({id:'existing',decision:'reuse',frame:13});
    assert.equal((await audit()).cues[0].secondAttack,undefined);
  } finally { await rm(dir,{recursive:true,force:true}); }
});


test('an all-reuse movie copies just the chosen original soundtrack, retaining a one-LSB added stem on the mix path', async (t) => {
  const ff = ffmpegPath();
  if (spawnSync(ff, ['-version']).error?.code === 'ENOENT') return t.skip('FFmpeg required');
  const tmp = await mkdtemp(join(tmpdir(), 'lumina-original-only-'));
  const file = name => join(tmp,name);
  function run(...args) {
    const result = spawnSync(ff,['-v','error','-nostdin',...args]);
    assert.equal(result.status,0,result.stderr.toString());
    return result.stdout.toString();
  }
  const streamHash = (name,stream) => run('-i',file(name),'-map',stream,'-c','copy','-f','hash','-');
  try {
    run('-f','lavfi','-i','color=size=48x48:rate=25:duration=1','-f','lavfi','-i','sine=f=850:d=1',
      '-f','lavfi','-i','sine=f=300:d=1','-map','0:v','-map','1:a','-map','2:a','-c:v','libx264','-c:a','aac',file('source.mp4'));
    const samples = new Float32Array(44100);
    await writeFile(file('quiet.wav'), Buffer.from(encodeWav(samples)));
    const kept = await mixPicture(file('source.mp4'),file('quiet.wav'),file('kept.mp4'),1);
    assert.equal(kept.audioEncoding,'copy');
    assert.equal(streamHash('kept.mp4','0:a:0'),streamHash('source.mp4','0:a:1'));
    assert.equal(streamHash('kept.mp4','0:v:0'),streamHash('source.mp4','0:v:0'));
    samples[samples.length-1]=1/32767;
    await writeFile(file('faint.wav'), Buffer.from(encodeWav(samples)));
    const mixed = await mixPicture(file('source.mp4'),file('faint.wav'),file('faint.mp4'),1);
    assert.notEqual(mixed.audioEncoding,'copy');
  } finally { await rm(tmp,{recursive:true,force:true}); }
});
