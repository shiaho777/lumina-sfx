import { signatureChanges } from './edit-family.mjs';
// Audit decoded picture, including the transport codec, against the source and authored stem.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { ffmpegPath } from './audio-export.mjs';
import { mediaInfo } from './edit-media.mjs';
import { clock } from './edit-score.mjs';

const rate = 48000,
  window = 960;
const db = (ratio) => (ratio > 0 ? Math.round(1000 * Math.log10(ratio)) / 100 : null);
const add = (a, b) => {
  for (let i = 0; i < a.length; i++) a[i] += b[i];
  return a;
};
const empty = () => new Float64Array(10);
// Sufficient statistics for regressing the delivered samples on BOTH input stems.
// This factors out narration correlated with a short cue. A quiet or collinear
// reference supplies too little evidence, so leave that gain unreported.
function levels(a) {
  const [ss, xx, yy, sx, sy, xy, phone, frames, sourcePhone, addedPhone] = a;
  const conditional = xx - (ss ? (sx * sx) / ss : 0);
  const gain =
    conditional > Math.max(1e-9, xx * 0.04) ? (xy - (ss ? (sx * sy) / ss : 0)) / conditional : null;
  const sourceEnergy = ss - (xx ? (sx * sx) / xx : 0);
  const original =
    sourceEnergy > Math.max(1e-9, ss * 0.04) ? (sy - (xx ? (sx * xy) / xx : 0)) / sourceEnergy : null;
  const phoneMargin =
    sourcePhone > 1e-10 && addedPhone > 1e-10 && gain > 0
      ? db((addedPhone * gain * gain) / sourcePhone)
      : null;
  return {
    phoneMarginDb: phoneMargin,
    monoPhoneSourceDbfs: db(sourcePhone / frames),
    monoPhoneAddedDbfs: gain > 0 ? db((addedPhone * gain * gain) / frames) : null,
    originalGainDb: original > 0 ? db(original * original) : null,
    addedGainDb: gain > 0 ? db(gain * gain) : null,
    addedRmsDbfs: db(xx / (2 * frames)),
    sourceRmsDbfs: db(ss / (2 * frames)),
    mixRmsDbfs: db(yy / (2 * frames)),
    monoPhoneMixDbfs: db(phone / frames),
  };
}

// Inspect an isolated physical press in the finished movie. A second discrete
// attack can come from the supplied soundtrack, the added take, or both.
function secondContact(bins, frame, fps) {
  const at = Math.floor((frame / fps) * rate / window);
  const energy = (i, column) => (bins[i]?.[column] ?? 0) / Math.max(1, 2 * (bins[i]?.[7] ?? 0));
  const strongest = choices => choices.reduce((a, b) => energy(a, 2) > energy(b, 2) ? a : b);
  const first = strongest([at - 1, at, at + 1]);
  const initial = energy(first, 2);
  if (initial < 1e-7) return;
  for (let i = first + 3; i <= first + 9 && i + 2 < bins.length; i++) {
    const next = energy(i, 2);
    if (next < initial * 0.16 || next < energy(i - 1, 2) || next < energy(i + 1, 2)) continue;
    const floor = Math.min(initial, next) * 0.063;
    if (!Array.from({ length: i - first - 1 }, (_, k) => energy(first + k + 1, 2)).some(v => v < floor) ||
        energy(first - 2, 2) > floor || energy(i + 2, 2) > floor) continue;
    const original = energy(i, 0), added = energy(i, 1);
    return {
      separationMs: Math.round((i - first) * window * 1000 / rate),
      relativeDb: db(next / initial),
      source: original > added * 4 ? 'original' : added > original * 4 ? 'added' : 'both',
    };
  }
}

export async function auditDelivery(plan, source, stem, mix, stream = 0) {
  const { fps, durationFrames } = clock(plan);
  const [picture, delivered, authored] = await Promise.all([
    mediaInfo(source, true),
    mediaInfo(mix, true),
    mediaInfo(stem, false),
  ]);
  const length = durationFrames / fps,
    tolerance = Math.max(0.055, 1.1 / fps);
  if ([picture, delivered, authored].some((info) => Math.abs(info.seconds - length) > tolerance))
    throw Error('Use a plan, original, stem and delivered picture from the same edit');
  if (!Number.isSafeInteger(stream) || stream < 0 || stream >= Math.max(1, picture.audioStreams))
    throw Error('Unknown original audio stream');
  const args = [
    '-v',
    'error',
    '-nostdin',
    '-copyts',
    '-start_at_zero',
    '-i',
    resolve(mix),
    '-i',
    resolve(stem),
  ];
  if (picture.audioStreams) args.push('-i', resolve(source));
  else args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
  const fmt = 'aresample=48000:async=1:first_pts=0,aformat=sample_fmts=fltp:channel_layouts=stereo,apad';
  const maps = '0.0-FL|0.1-FR|1.0-FC|1.1-LFE|2.0-BL|2.1-BR';
  args.push(
    '-filter_complex',
    '[2:a:' +
      stream +
      ']' +
      fmt +
      '[src];[1:a:0]' +
      fmt +
      '[stem];[0:a:0]' +
      fmt +
      '[mix];[src][stem][mix]join=inputs=3:channel_layout=5.1:map=' +
      maps +
      '[bundle]',
    '-map',
    '[bundle]',
    '-t',
    String(length),
    '-f',
    'f32le',
    'pipe:1',
  );
  const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const done = once(proc, 'close').then(
    ([status]) => ({ status }),
    (error) => ({ error }),
  );
  let stderr = '',
    spare = Buffer.alloc(0),
    frame = 0,
    peak = 0,
    peakAt = 0,
    block = empty();
  const low = new Float64Array(3),
    high = new Float64Array(3);
  proc.stderr.on('data', (b) => {
    stderr = (stderr + b).slice(-1500);
  });
  const bins = [],
    total = empty();
  const smoothLow = 1 - Math.exp((-2 * Math.PI * 300) / rate),
    smoothHigh = 1 - Math.exp((-2 * Math.PI * 3600) / rate);
  for await (const chunk of proc.stdout) {
    const data = spare.length ? Buffer.concat([spare, chunk]) : chunk;
    const end = data.length - (data.length % 24);
    for (let i = 0; i < end; i += 24) {
      let originalMono = 0,
        stemMono = 0,
        mixMono = 0;
      for (let ear = 0; ear < 2; ear++) {
        const s = data.readFloatLE(i + 4 * ear),
          x = data.readFloatLE(i + 8 + 4 * ear),
          y = data.readFloatLE(i + 16 + 4 * ear);
        block[0] += s * s;
        block[1] += x * x;
        block[2] += y * y;
        block[3] += s * x;
        block[4] += s * y;
        block[5] += x * y;
        originalMono += s * 0.5;
        stemMono += x * 0.5;
        mixMono += y * 0.5;
        if (Math.abs(y) > peak) {
          peak = Math.abs(y);
          peakAt = frame / rate;
        }
      }
      for (let k = 0; k < 3; k++) {
        const mono = k === 0 ? originalMono : k === 1 ? stemMono : mixMono;
        low[k] += smoothLow * (mono - low[k]);
        high[k] += smoothHigh * (mono - low[k] - high[k]);
        block[k === 2 ? 6 : 8 + k] += high[k] * high[k];
      }
      block[7]++;
      frame++;
      if (frame % window === 0) {
        add(total, block);
        bins.push(block);
        block = empty();
      }
    }
    spare = data.subarray(end);
  }
  const closed = await done;
  if (closed.error) throw closed.error;
  if (closed.status || !frame) throw Error(stderr || 'No delivered audio');
  if (block[7]) {
    add(total, block);
    bins.push(block);
  }
  const cues = [];
  const inputFrames = plan.cues.filter(c => c.decision !== 'silence')
    .flatMap(c => c.keyFrames ?? [c.syncFrame ?? c.frame]).filter(Number.isFinite).sort((a, b) => a - b);
  const adjacent = new Map(inputFrames.map((f, i) => [f, [inputFrames[i - 1], inputFrames[i + 1]]]));
  for (const cue of plan.cues) {
    if (cue.decision !== 'play') continue;
    for (const [i, f] of (cue.keyFrames ?? [cue.syncFrame]).entries()) {
      if (cue.keyDecisions && cue.keyDecisions[i] !== 'play') continue;
      const at = f / fps,
        lo = Math.max(0, Math.floor(((at - 0.02) * rate) / window)),
        hi = Math.min(bins.length, Math.ceil(((at + 0.085) * rate) / window));
      const stats = empty();
      for (let k = lo; k < hi; k++) add(stats, bins[k]);
      const level = levels(stats),
        warnings = [];
      if (level.addedRmsDbfs === null) warnings.push('No authored contact in this window');
      else if (level.addedGainDb === null || level.addedGainDb < -6)
        warnings.push('Audition contact against the delivered original');
      if (
        level.monoPhoneSourceDbfs !== null &&
        level.monoPhoneSourceDbfs > -40 &&
        level.phoneMarginDb !== null
      ) {
        if (level.phoneMarginDb < -18)
          warnings.push('Audition this contact for masking on a quiet mono speaker');
        if (cue.context !== 'hero' && level.phoneMarginDb > 8)
          warnings.push('Audition this ordinary contact for prominence over the original');
      }
      const [prior, next] = adjacent.get(f) ?? [];
      const isSingleSwitch = /^press\/(?:mouse|trackpad|trackball|pen-button|touch\/surface)(?:\/|$)/.test(cue.signature ?? '') &&
        !/double|triple|hold|release/.test(cue.soundId ?? '') && !cue.keyFrames;
      const isolated = !(prior >= f - 0.2 * fps || next <= f + 0.2 * fps);
      const extra = isSingleSwitch && isolated ? secondContact(bins, f, fps) : undefined;
      if (extra) warnings.push('Listen for a second attack after this single physical press');
      cues.push({ id: cue.id, frame: f, ...level, ...(extra ? { secondAttack: extra } : {}), warnings });
    }
  }
  const mixPeakDbfs = db(peak * peak),
    overall = levels(total);
  const changes = signatureChanges(plan.cues);
  return {
    seconds: frame / rate,
    mixPeakDbfs,
    peakAtSec: Math.round(1000 * peakAt) / 1000,
    ...overall,
    signatureChanges: changes,
    warnings: [
      ...changes.map(change => 'Audition the change of material or fixed take for ' + change.signature),
      ...(peak >= 1 ? ['Decoded sample reaches full scale'] : []),
      ...(overall.originalGainDb !== null && Math.abs(overall.originalGainDb) > 1
        ? ['Check original soundtrack level']
        : []),
    ],
    cues,
  };
}


const decode = promisify(execFile);

// Probe the delivered stereo pair at author-supplied times. Mono files decode to equal channels.
export async function probeStereo(file, times, windowMs = 180, stream = 0) {
  if (!Array.isArray(times) || !times.length || times.length > 64 ||
      times.some(t => !Number.isFinite(t) || t < 0)) throw Error('Supply 1–64 nonnegative probe times in seconds');
  if (!Number.isFinite(windowMs) || windowMs < 10 || windowMs > 500) throw Error('Use a 10–500 ms probe window');
  const media = await mediaInfo(file, false);
  if (!Number.isSafeInteger(stream) || stream < 0 || stream >= media.audioStreams) throw Error('Unknown audio stream');
  const windows = [];
  for (const atSec of times) {
    if (atSec >= media.seconds) throw Error('Probe time falls outside the file: ' + atSec);
    const { stdout } = await decode(ffmpegPath(), [
      '-v', 'error', '-nostdin', '-ss', String(atSec), '-i', resolve(file),
      '-map', '0:a:' + stream, '-t', String(windowMs / 1000), '-ac', '2', '-ar', String(rate), '-f', 'f32le', 'pipe:1',
    ], { encoding: 'buffer', maxBuffer: rate * 8 });
    const frames = stdout.length / 8;
    if (!frames || !Number.isInteger(frames)) throw Error('Empty or incomplete decoded probe at ' + atSec);
    let left = 0, right = 0, mono = 0, peak = 0;
    for (let i = 0; i < stdout.length; i += 8) {
      const l = stdout.readFloatLE(i), r = stdout.readFloatLE(i + 4);
      left += l * l;
      right += r * r;
      mono += ((l + r) / 2) ** 2;
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
    }
    const total = left + right;
    const rmsDbfs = db(total / (2 * frames));
    const rightMinusLeftDb = left && right ? db(right / left) : null;
    const side = (rmsDbfs ?? -Infinity) < -75 ? 'quiet' :
      !left ? 'right' : !right ? 'left' :
      rightMinusLeftDb > 1 ? 'right' : rightMinusLeftDb < -1 ? 'left' : 'center';
    windows.push({ atSec, decodedMs: frames * 1000 / rate, side, rightMinusLeftDb,
      leftDbfs: db(left / frames), rightDbfs: db(right / frames), stereoRmsDbfs: rmsDbfs,
      monoRmsDbfs: db(mono / frames), peakDbfs: db(peak * peak) });
  }
  return { file: resolve(file), stream, windowMs, windows };
}
