import { designedRecipe } from './sculpt.ts';
import { clamp, closeLoop, dbToGain, rng } from './dsp.ts';
import { balanceLevels, balanceSettings, resolveMixRole } from './levels.ts';
import type { RenderOptions, SoundRecipe } from './types.ts';

export const SAMPLE_RATE = 44_100;
export const PEAK_LIMIT_DB = -0.5;
export const DEFAULT_SEED = 104729;
export function targetRmsDb(loop: boolean, override?: number): number {
  const target = override ?? (loop ? -21 : -18);
  if (!Number.isFinite(target) || target > PEAK_LIMIT_DB) {
    throw new RangeError('Active RMS target must be finite and at or below the peak ceiling');
  }
  return target;
}

// Gate quiet tail blocks so silence and reverb do not increase perceived level.
export function activeRms(samples: Float32Array, sampleRate: number): number {
  const blockSize = Math.round(sampleRate * 0.02);
  const blocks: Array<{ sum: number; length: number }> = [];
  let maxMean = 0;
  for (let start = 0; start < samples.length; start += blockSize) {
    const end = Math.min(start + blockSize, samples.length);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    blocks.push({ sum, length: end - start });
    maxMean = Math.max(maxMean, sum / (end - start));
  }
  const gate = Math.max(1e-9, maxMean * dbToGain(-16) ** 2);
  let sum = 0;
  let count = 0;
  for (const block of blocks) {
    if (block.sum / block.length < gate) continue;
    sum += block.sum;
    count += block.length;
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}

function taper(samples: Float32Array, sampleRate: number): void {
  const start = Math.max(1, Math.round(sampleRate * 0.0002));
  const end = Math.min(Math.round(sampleRate * 0.022), samples.length / 2 | 0);
  for (let i = 0; i < start; i++) samples[i] *= i / start;
  for (let i = 0; i < end; i++) {
    samples[samples.length - 1 - i] *= (1 - Math.cos(Math.PI * i / end)) * 0.5;
  }
}

// Align a genuine attack to the end of a 0.2 ms de-click ramp. Trimming the
// attack to frame zero and then fading it can erase the only early contact.
function shotStart(onset: number, sampleRate: number): number {
  return Math.max(0, onset) - Math.max(1, Math.round(sampleRate * 0.0002));
}

function alignAttack(raw: Float32Array, start: number, sampleRate: number): Float32Array {
  const shot = new Float32Array(raw.length);
  for (let i = 0; i < shot.length && i + start < raw.length; i++) {
    shot[i] = raw[Math.max(0, i + start)];
  }
  taper(shot, sampleRate);
  return shot;
}

function findShotStart(raw: Float32Array, sampleRate: number): number {
  let peak = 0;
  for (const sample of raw) peak = Math.max(peak, Math.abs(sample));
  const onset = raw.findIndex(sample => Math.abs(sample) >= peak * 0.035);
  return shotStart(onset, sampleRate);
}

function master(input: Float32Array, sampleRate: number, rmsDbfs: number): Float32Array {
  for (const sample of input) {
    if (!Number.isFinite(sample)) throw new Error('Recipe produced a non-finite sample');
  }
  const target = dbToGain(rmsDbfs);
  const preRms = activeRms(input, sampleRate);
  if (!preRms) return input;
  const ceiling = dbToGain(PEAK_LIMIT_DB - 0.08);
  const knee = dbToGain(-3);
  let gain = target / preRms;
  const output = new Float32Array(input.length);
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < input.length; i++) {
      const scaled = input[i] * gain;
      const magnitude = Math.abs(scaled);
      output[i] = magnitude <= knee ? scaled :
        Math.sign(scaled) * (knee + (ceiling - knee) * Math.tanh((magnitude - knee) / (ceiling - knee)));
    }
    const rms = activeRms(output, sampleRate);
    if (Math.abs(rms / target - 1) < 0.006) break;
    gain *= clamp(target / Math.max(rms, 1e-9), 0.7, 1.5);
  }
  return output;
}

function renderContext(recipe: SoundRecipe, opts: RenderOptions, sampleRate: number) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new RangeError('Sample rate must be an integer from 8000 to 192000 Hz');
  }
  const frames = Math.round(recipe.durationSec * sampleRate);
  if (!Number.isFinite(frames) || frames < sampleRate * 0.01 || frames > sampleRate * 120) {
    throw new RangeError(`${recipe.id}: duration must be between 0.01 and 120 seconds`);
  }
  const overlap = recipe.loopable ? Math.min(Math.round(sampleRate * 0.075), frames >> 2) : 0;
  const params = Object.fromEntries(Object.entries(recipe.params).map(([key, spec]) => {
    const value = opts.params?.[key];
    return [key, value === undefined || !Number.isFinite(value) ? spec.default : clamp(value, spec.min, spec.max)];
  }));
  const seed = Number.isFinite(opts.seed) ? opts.seed! >>> 0 : DEFAULT_SEED;
  const ctx = { sampleRate, frames: frames + overlap, random: rng(seed) };
  return { ctx, resolved: { seed, params }, frames, overlap };
}

export function renderSound(recipe: SoundRecipe, opts: RenderOptions = {}, sampleRate = SAMPLE_RATE): Float32Array {
  return renderMono(recipe, opts, sampleRate).samples;
}

function renderMono(recipe: SoundRecipe, opts: RenderOptions, sampleRate: number) {
  recipe = designedRecipe(recipe, opts.macros);
  const { ctx, resolved, frames, overlap } = renderContext(recipe, opts, sampleRate);
  const raw = recipe.render(ctx, resolved);
  if (!(raw instanceof Float32Array) || raw.length !== ctx.frames) {
    throw new Error(`${recipe.id}: render must return exactly ${ctx.frames} Float32 samples`);
  }
  const target = targetRmsDb(recipe.loopable, recipe.targetRmsDbfs);
  const sourceStartFrame = recipe.loopable ? 0 : findShotStart(raw, sampleRate);
  const prepared = recipe.loopable ? closeLoop(raw, frames, overlap) : alignAttack(raw, sourceStartFrame, sampleRate);
  const output = master(prepared, sampleRate, target);
  const samples = opts.level === 'balanced' ? balanceLevels(output, sampleRate, resolveMixRole(recipe)) : output;
  return { samples, sourceStartFrame };
}

// One clock, trim and gain for the pair keeps arrivals and stereo perspective intact.
export function renderChannels(recipe: SoundRecipe, opts: RenderOptions = {}, sampleRate = SAMPLE_RATE): Float32Array[] {
  return renderWithTiming(recipe, opts, sampleRate).channels;
}

export function renderWithTiming(recipe: SoundRecipe, opts: RenderOptions = {}, sampleRate = SAMPLE_RATE) {
  if (!recipe.renderStereo) {
    const { samples, sourceStartFrame } = renderMono(recipe, opts, sampleRate);
    return { channels: [samples], sourceStartFrame };
  }
  recipe = designedRecipe(recipe, opts.macros);
  const { ctx, resolved, frames, overlap } = renderContext(recipe, opts, sampleRate);
  const raw = recipe.renderStereo!(ctx, resolved);
  if (raw.length !== 2 || raw.some(c => !(c instanceof Float32Array) || c.length !== ctx.frames)) {
    throw new Error(recipe.id + ': stereo renderer must return two equal-length channels');
  }
  let peak = 0;
  for (const c of raw) for (const x of c) {
    if (!Number.isFinite(x)) throw new Error('Non-finite stereo sample');
    peak = Math.max(peak, Math.abs(x));
  }
  let onset = 0;
  while (onset < frames && Math.max(Math.abs(raw[0][onset]), Math.abs(raw[1][onset])) < peak * 0.035) onset++;
  const sourceStartFrame = recipe.loopable ? 0 : shotStart(onset, sampleRate);
  const channels = raw.map(c => recipe.loopable
    ? closeLoop(c, frames, overlap)
    : alignAttack(c, sourceStartFrame, sampleRate));
  const interleaved = new Float32Array(frames*2);
  for (let i = 0; i < frames; i++) {
    interleaved[i*2] = channels[0][i];
    interleaved[i*2+1] = channels[1][i];
  }
  const linked = master(interleaved, sampleRate*2, targetRmsDb(recipe.loopable, recipe.targetRmsDbfs));
  for (const [side, c] of channels.entries()) {
    for (let i = 0; i < frames; i++) c[i] = linked[i*2+side];
  }
  if (opts.level === 'balanced') {
    const gainDb = Math.min(...channels.map(c => balanceSettings(c, sampleRate, resolveMixRole(recipe)).gainDb));
    const gain = dbToGain(gainDb);
    for (const c of channels) for (let i = 0; i < frames; i++) c[i] *= gain;
  }
  return { channels, sourceStartFrame };
}
