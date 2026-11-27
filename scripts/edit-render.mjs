import { open, link, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { renderChannels, SAMPLE_RATE } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';
import { clock, eligible } from './edit-score.mjs';

function renderTake(e, rate) {
  const pcm = renderChannels(e.recipe, { seed: e.seed, level: 'balanced', macros: { speed: e.speed } });
  if (e.edgeDb) {
    const edge = 10 ** (e.edgeDb / 20), alpha = 1 - Math.exp(-2 * Math.PI * 2400 / rate);
    for (const channel of pcm) {
      let low = 0;
      for (let i = 0; i < channel.length; i++) {
        low += alpha * (channel[i] - low);
        channel[i] = low + (channel[i] - low) * edge;
      }
    }
  }
  return pcm;
}

export async function renderEdit(plan, catalog, out) {
  if (plan.schemaVersion !== 1 || !Array.isArray(plan.cues)) throw Error('Expected a scored picture');
  const { fps, durationFrames } = clock(plan),
    rate = SAMPLE_RATE,
    frames = Math.round((durationFrames / fps) * rate);
  if (frames * 4 + 36 > 0xffffffff)
    throw Error('The timeline exceeds the PCM WAV size limit. Export it in reels.');
  const ids = new Set(),
    bank = new Map(catalog.map((s) => [s.id, s])),
    events = [];
  for (const cue of plan.cues) {
    if (ids.has(cue.id) || !['play', 'review', 'reuse', 'silence'].includes(cue.decision))
      throw Error('Invalid cue ' + cue.id);
    ids.add(cue.id);
    if (cue.decision !== 'play') continue;
    const s = bank.get(cue.soundId);
    if (!eligible(s) || cue.revision !== (s.revision ?? 1))
      throw Error('Unreviewed or changed source for ' + cue.id);
    if (
      !Number.isInteger(cue.seed) ||
      !Number.isFinite(cue.gainDb) ||
      cue.gainDb < -80 ||
      cue.gainDb > 12 ||
      !Number.isFinite(cue.speed) ||
      cue.speed < 0.25 ||
      cue.speed > 4 ||
      !Number.isFinite(cue.markerSec) ||
      cue.markerSec < 0 ||
      cue.markerSec > s.durationSec
    )
      throw Error('Invalid performance ' + cue.id);
    if (cue.edgeDb !== undefined && (!Number.isFinite(cue.edgeDb) || cue.edgeDb < -12 || cue.edgeDb > 0))
      throw Error('Invalid edge trim');
    if (
      cue.keyGainOffsets !== undefined &&
      (!Array.isArray(cue.keyGainOffsets) ||
        cue.keyGainOffsets.length !== cue.keyFrames?.length ||
        cue.keyGainOffsets.some((v) => !Number.isFinite(v) || Math.abs(v) > 60))
    )
      throw Error('Invalid per-key gain offsets');
    if (
      cue.keyDecisions &&
      (!Array.isArray(cue.keyDecisions) ||
        cue.keyDecisions.length !== cue.keyFrames?.length ||
        cue.keyDecisions.some((d) => !['play', 'reuse', 'review'].includes(d)))
    )
      throw Error('Invalid per-key decisions');
    if (
      cue.fitMotion &&
      (!Number.isSafeInteger(cue.endFrame) || cue.endFrame <= cue.frame || cue.endFrame > durationFrames)
    )
      throw Error('Invalid visible accent span');
    const { default: base } = await import('../recipes/' + s.id + '.ts');
    if (cue.motion === 'follow' && (!cue.fitMotion || !base.withGestureTiming ||
        cue.syncFrame <= cue.frame || cue.syncFrame >= cue.endFrame))
      throw Error('Place a native sweep accent inside the visible motion for ' + cue.id);
    let recipe = base;
    let marker = cue.markerSec / cue.speed;
    let speed = cue.speed;
    let exposureGain = 1;
    if (['turn', 'follow'].includes(cue.motion) && cue.fitMotion && base.withGestureTiming) {
      const before = (cue.syncFrame - cue.frame) / fps;
      const after = (cue.endFrame - cue.syncFrame) / fps;
      // Very long edits exceed the native recipe's render limit. A paired turn
      // can still use the original accent window around the marked frame.
      const accentOnly = cue.motion === 'turn' && before + after > 120;
      const rise = accentOnly ? Math.min(before, 0.26) : before;
      const fall = accentOnly ? Math.min(after, 0.22) : after;
      if (rise > 0 && fall > 0 && rise + fall >= 0.01) {
        const fitted = base.withGestureTiming(rise + fall, rise, cue.motion === 'turn' ? 'turn' : undefined, cue.screenPath);
        recipe = { ...fitted, immediateOnset: false };
        // Longer airflow occupies more of the edit. Keep its energy near the approved accent
        // without pushing an intentionally long stroke below the surrounding soundtrack.
        exposureGain = cue.motion === 'turn'
          ? Math.max(0.35, Math.min(1, Math.sqrt(2 * base.durationSec / recipe.durationSec)))
          : Math.max(0.60, Math.min(1, Math.sqrt(base.durationSec / recipe.durationSec)));
        marker = rise;
        speed = 1;
      }
    }
    for (const [i, frame] of (cue.keyFrames ?? [cue.syncFrame]).entries()) {
      if (!Number.isSafeInteger(frame) || frame < 0 || frame >= durationFrames)
        throw Error('Sync frame outside the edit: ' + cue.id);
      if (cue.keyDecisions && cue.keyDecisions[i] !== 'play') continue;
      events.push({
        start: Math.round((frame / fps - marker) * rate),
        recipe,
        fixedTake: cue.fixedTake === true,
        motion: cue.motion,
        screenPath: cue.screenPath,
        ...(cue.fitMotion
          ? {
              visibleStart: Math.round((cue.frame / fps) * rate),
              visibleEnd: Math.round((cue.endFrame / fps) * rate),
            }
          : {}),
        seed: (cue.seed + Math.imul(i, 8191)) >>> 0,
        speed,
        marker,
        edgeDb: cue.edgeDb,
        gain: exposureGain * 10 ** (Math.max(-80, Math.min(12, cue.gainDb + (cue.keyGainOffsets?.[i] ?? 0))) / 20),
      });
    }
  }
  events.sort((a, b) => a.start - b.start);
  const dest = resolve(out);
  await mkdir(dirname(dest), { recursive: true });
  const temp = await mkdtemp(join(dirname(dest), '.lumina-stem-')),
    wav = join(temp, 'track.wav');
  const takes = new Map();
  let renderedTakes = 0,
    peak = 0,
    idx = 0,
    active = [],
    energy = 0,
    monoEnergy = 0;
  try {
    const file = await open(wav, 'wx');
    try {
      const header = Buffer.from(encodeWav([new Float32Array(), new Float32Array()], rate));
      header.writeUInt32LE(36 + 4 * frames, 4);
      header.writeUInt32LE(4 * frames, 40);
      await file.writeFile(header);
      for (let at = 0; at < frames; at += 16384) {
        const n = Math.min(16384, frames - at),
          block = [new Float32Array(n), new Float32Array(n)];
        while (idx < events.length && events[idx].start < at + n) {
          const e = events[idx++];
          const key = e.fixedTake ? JSON.stringify([e.recipe.id, e.seed, e.speed, e.recipe.durationSec, e.marker, e.edgeDb ?? 0, e.motion, e.screenPath]) : undefined;
          let pcm = key && takes.get(key);
          if (!pcm) {
            pcm = renderTake(e, rate);
            renderedTakes++;
            if (key && pcm.reduce((bytes, ch) => bytes + ch.byteLength, 0) <= 2 * 1024 * 1024) {
              if (takes.size === 4) takes.delete(takes.keys().next().value);
              takes.set(key, pcm);
            }
          }
          active.push({ ...e, pcm, end: Math.min(e.visibleEnd ?? Infinity, e.start + pcm[0].length) });
        }
        for (const e of active) {
          for (
            let i = Math.max(0, e.start - at, (e.visibleStart ?? 0) - at);
            i < Math.min(n, e.end - at);
            i++
          ) {
            const sample = at + i;
            const fadeOut =
              e.visibleEnd !== undefined || e.end > frames
                ? Math.min(1, (Math.min(e.end, frames) - 1 - sample) / (rate * 0.015))
                : 1;
            const fadeIn =
              e.visibleStart !== undefined && e.start < e.visibleStart
                ? Math.min(1, (sample - e.visibleStart) / (rate * 0.005))
                : 1;
            const fade = fadeIn * fadeOut;
            for (let ch = 0; ch < 2; ch++)
              block[ch][i] += (e.pcm[ch] ?? e.pcm[0])[sample - e.start] * e.gain * fade;
          }
        }
        active = active.filter((e) => e.end > at + n);
        for (let s = 0; s < n; s++) {
          const l = block[0][s],
            r = block[1][s];
          peak = Math.max(peak, Math.abs(l), Math.abs(r));
          energy += (l * l + r * r) / 2;
          monoEnergy += ((l + r) * 0.5) ** 2;
        }
        if (!Number.isFinite(peak) || peak > 10 ** (-0.5 / 20))
          throw Error('SFX overlap exceeds the peak ceiling. Lower one of the overlapping cues.');
        const bytes = Buffer.from(encodeWav(block, rate));
        await file.writeFile(bytes.subarray(44));
      }
    } finally {
      await file.close();
    }
    await link(wav, dest);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  return {
    file: dest,
    frames,
    events: events.length,
    renderedTakes,
    reusedTakes: events.length - renderedTakes,
    review: plan.cues
      .filter((c) => c.decision === 'review' || c.keyDecisions?.includes('review'))
      .map((c) => c.id),
    peakDbfs: peak ? 20 * Math.log10(peak) : null,
    monoEnergyRatio: energy ? monoEnergy / energy : null,
  };
}
