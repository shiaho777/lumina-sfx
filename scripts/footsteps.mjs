#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contactEarFilters, contactGain, contactSamples, FootstepWalker, gaitEffort, stepIntervalSec } from '../engine/footsteps.ts';
import { rng } from '../engine/dsp.ts';
import { encodeWav } from '../engine/wav.ts';
import { loadRecipes } from './recipes.mjs';
import { publishAsset } from './audio-export.mjs';

export const surfaces = ['hardwood', 'concrete', 'gravel', 'grass', 'puddle', 'metal-stairs', 'snow', 'mud', 'sand'];
const rate = 44100;
function choice(value, allowed, label) {
  if (!allowed.includes(value)) throw Error(label + ' expects ' + allowed.join(' | '));
  return value;
}
function number(value, lo, hi, label, integer = false) {
  if (!Number.isFinite(value) || value < lo || value > hi || (integer && !Number.isInteger(value)))
    throw Error(label + ' must be between ' + lo + ' and ' + hi);
  return value;
}
function fields(input, keys, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid ' + label);
  for (const k of Object.keys(input)) if (!keys.includes(k)) throw Error('Unknown ' + label + ' field ' + k);
}
function pose(input, listener = false) {
  fields(input, listener ? ['x','z','yaw','earHeightM'] : ['x','z','yaw'], 'pose');
  if (listener) number(input.earHeightM ?? 1.6, 0, Infinity, 'earHeightM');
  for (const axis of ['x','z']) number(input[axis], -10000, 10000, axis);
  number(input.yaw ?? 0, -1000, 1000, 'yaw');
  return input;
}
function segment(input) {
  fields(input, ['surface','steps','gait','transitionSteps','footwear','firstFoot','wetness','weight','travel','motion','from','to','listener'], 'segment');
  choice(input.surface, surfaces, 'surface');
  number(input.steps, 1, 256, 'steps', true);
  number(input.transitionSteps ?? 0, 0, input.steps, 'transitionSteps', true);
  choice(input.gait ?? 'walk', Object.keys(stepIntervalSec), 'gait');
  choice(input.motion ?? 'steady', ['steady','push-off','brake','pivot'], 'motion');
  choice(input.travel ?? 'forward', ['forward','backward','left','right'], 'travel');
  choice(input.footwear ?? 'shoe', ['shoe','boot'], 'footwear');
  if (input.firstFoot !== undefined) choice(input.firstFoot, ['left','right'], 'firstFoot');
  number(input.weight ?? .5, 0, 1, 'weight');
  number(input.wetness ?? 0, 0, 1, 'wetness');
  if (!!input.from !== !!input.to) throw Error('Supply both from and to for a moving actor');
  if (input.listener && !input.from) throw Error('A listener needs an actor path');
  for (const p of [input.from,input.to]) if (p !== undefined) pose(p);
  if (input.listener !== undefined) pose(input.listener, true);
  return input;
}
function actorAt(s, fraction) {
  if (!s.from) return undefined;
  const dx = s.to.x - s.from.x, dz = s.to.z - s.from.z;
  const lateral = {forward: 0, backward: Math.PI, left: -Math.PI/2, right: Math.PI/2};
  const along = dx || dz ? Math.atan2(dx, -dz) : 0;
  const start = s.from.yaw ?? along - lateral[s.travel ?? 'forward'];
  const diff = (s.to.yaw ?? start) - start;
  return {x:s.from.x + fraction * dx, z:s.from.z + fraction * dz,
    yaw:start + fraction * Math.atan2(Math.sin(diff), Math.cos(diff))};
}
async function recipeMap(segments) {
  const wanted = new Set(segments.map(s => 'stride-' + s.surface));
  const recipes = await loadRecipes(wanted);
  return new Map(recipes.map(r => [r.id, r]));
}

/** Render the same movement decisions used by animation-driven playback. */
export async function renderRoute(inputs, seed = 104729, output = 'stereo') {
  choice(output, ['stereo','headphones'], 'output');
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 256) throw Error('Expected an array of movement segments');
  number(seed, 0, 0xffffffff, 'seed', true);
  const segments = inputs.map(segment);
  if (segments.reduce((sum,s) => sum + s.steps * stepIntervalSec[s.gait ?? 'walk'], 0) > 116)
    throw Error('Use a route under two minutes');
  const recipes = await recipeMap(segments);
  const walker = new FootstepWalker(seed), cadence = rng(seed ^ 0x329f5);
  const hits = [];
  let at = 0, end = 0;
  const totalSteps = segments.reduce((sum, s) => sum + s.steps, 0);
  let previousGait = segments[0].gait ?? 'walk';
  for (const s of segments) {
    const gait = s.gait ?? 'walk';
    const recipe = recipes.get('stride-' + s.surface);
    for (let i = 0; i < s.steps; i++) {
      const first = hits.length === 0, last = hits.length === totalSteps - 1;
      const motion = s.motion ?? (totalSteps === 1 ? 'steady' : first ? 'push-off' : last ? 'brake' : 'steady');
      const blend = s.transitionSteps ? Math.min(1, (i + 1) / s.transitionSteps) : 1;
      const effort = gaitEffort[previousGait] + blend * (gaitEffort[gait] - gaitEffort[previousGait]);
      const interval = stepIntervalSec[previousGait] + blend * (stepIntervalSec[gait] - stepIntervalSec[previousGait]);
      const hit = walker.plant(recipe, {...s, gait: effort, motion, actor: actorAt(s, s.steps === 1 ? 0 : i / (s.steps - 1)), foot: i === 0 ? s.firstFoot : undefined});
      const offset = Math.round(at * rate);
      hits.push({hit, offset, motion});
      end = Math.max(end, offset + Math.round(recipe.durationSec * rate));
      // A small timing variation in an authored walk. Live timing belongs to the animation.
      const settling = totalSteps > 2 && (first || hits.length === totalSteps - 1) ? 1.12 : 1;
      at += interval * settling * (.96 + .08 * cadence());
    }
    previousGait = gait;
  }
  if (output === 'headphones') end += contactEarFilters(hits[0].hit, rate)[0].length - 1;
  if (end > 120 * rate) throw Error('Use a route under two minutes');
  const channels = [new Float32Array(end),new Float32Array(end)];
  const events = [];
  for (const {hit,offset,motion} of hits) {
    const pcm = contactSamples(hit, rate);
    if (output === 'headphones') {
      // Convolve the same dry take and ear responses that the live Web Audio player uses.
      for (const [ch, filter] of contactEarFilters(hit, rate).entries()) {
        const dest = channels[ch];
        for (let tap = 0; tap < filter.length; tap++) {
          const gain = filter[tap] * hit.gain;
          if (gain === 0) continue;
          for (let i = 0; i < pcm.length; i++) dest[offset + tap + i] += pcm[i] * gain;
        }
      }
    } else {
      const angle = (hit.pan + 1) * Math.PI / 4;
      const left = hit.gain * Math.cos(angle), right = hit.gain * Math.sin(angle);
      for (let i = 0; i < pcm.length; i++) {
        channels[0][offset+i] += pcm[i] * left;
        channels[1][offset+i] += pcm[i] * right;
      }
    }
    events.push({frame:offset, id:hit.recipe.id, foot:hit.foot, motion, take:hit.take, pan:hit.pan, gain:hit.gain, relativePosition:hit.relativePosition});
  }
  let peak = 0;
  for (const channel of channels) for (const x of channel) peak = Math.max(peak, Math.abs(x));
  if (!(peak > 0 && Number.isFinite(peak))) throw Error('Invalid silent or nonfinite render');
  const ceiling = 10 ** (-1 / 20);
  if (peak > ceiling) for (const channel of channels) for (let i = 0; i < end; i++) channel[i] *= ceiling / peak;
  const credits = new Map();
  for (const r of recipes.values()) for (const credit of [r.recording, ...(r.additionalRecordings ?? [])]) credits.set(credit.url,credit);
  return {channels, events, output, sampleRate:rate, peakDbfs:20*Math.log10(Math.min(peak,ceiling)), credits:[...credits.values()]};
}

// A portable take pool for games that already have their own animation, mixer and panner.
async function exportBank(s, dir) {
  const recipe = (await recipeMap([s])).get('stride-' + s.surface);
  const walker = new FootstepWalker(1), takes = [];
  const files = new Map();
  for (const foot of ['left','right']) {
    for (let i = foot === 'left' ? 0 : 1; i < recipe.takeCount; i += 2) {
      const hit = walker.plant(recipe, {...s, foot});
      const pcm = contactSamples(hit);
      // Use a fixed profile gain. Leave position and small level variation to the host.
      const gain = contactGain(hit.params.gait, hit.params.weight);
      for (let f = 0; f < pcm.length; f++) pcm[f] *= gain;
      const file = foot + '-' + hit.take + '.wav';
      files.set(file, Buffer.from(encodeWav(pcm)));
      takes.push({foot, take:hit.take, file});
    }
  }
  const manifest = {surface:s.surface, gait:s.gait ?? 'walk', footwear:s.footwear ?? 'shoe',
    weight:s.weight ?? .5, wetness:s.wetness ?? 0, travel:s.travel ?? 'forward', motion:s.motion ?? 'steady', sampleRate:rate, takes,
    credits:[recipe.recording,...(recipe.additionalRecordings ?? [])]};
  files.set('footsteps.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  // Publish the complete pool together. A retry may verify an identical bank.
  await mkdir(dirname(dir), {recursive: true});
  const stage = await mkdtemp(join(dirname(dir), '.lumina-footsteps-'));
  try {
    for (const [name, bytes] of files) await writeFile(join(stage, name), bytes);
    try {
      await rename(stage, dir);
    } catch (error) {
      if (!['EEXIST','ENOTEMPTY','EPERM'].includes(error.code)) throw error;
      for (const [name, bytes] of files) {
        if (!bytes.equals(await readFile(join(dir, name))))
          throw Error('Existing bank differs: ' + dir + '. Use a new directory for this profile.');
      }
    }
  } finally {
    await rm(stage, {recursive: true, force: true});
  }
  return manifest;
}

async function main() {
  const options = Object.fromEntries(['surface','steps','gait','footwear','foot','wetness','weight','travel','motion','seed','route','out','bank','output'].map(k=>[k,{type:'string'}]));
  const {values:v} = parseArgs({options:{...options,help:{type:'boolean'}}});
  if (v.help) {
    console.log('node scripts/footsteps.mjs --surface hardwood --steps 8 --gait walk --out walk.wav\nUse --route segments.json --out scene.wav for mixed movement, add --output headphones for front/back localisation, or use --surface grass --bank /path/to/takes for native game audio.');
    return;
  }
  if (!!v.out === !!v.bank) throw Error('Choose --out file.wav or --bank directory');
  if (v.route && Object.keys(v).some(k => !['route','seed','out','output'].includes(k))) throw Error('A route supplies its own movement settings');
  if (v.bank && v.output !== undefined) throw Error('Use --output with --out. A native take bank contains mono files.');
  if (v.bank && [v.steps,v.seed,v.foot].some(x=>x!==undefined)) throw Error('A bank exports every foot and take');
  if (!v.route && !v.surface) throw Error('Specify --surface or --route');
  const s = v.route ? undefined : segment({surface:v.surface,steps:Number(v.steps ?? 1),gait:v.gait,footwear:v.footwear,
    wetness:Number(v.wetness ?? 0),weight:Number(v.weight ?? .5),travel:v.travel,motion:v.motion,firstFoot:v.foot});
  if (v.bank) { console.log(JSON.stringify(await exportBank(s,resolve(v.bank)))); return; }
  if (!v.out.toLowerCase().endsWith('.wav')) throw Error('--out expects a WAV path');
  const route = v.route ? JSON.parse(await readFile(v.route,'utf8')) : [s];
  const {channels,...report} = await renderRoute(route,Number(v.seed ?? 104729),v.output ?? 'stereo');
  await publishAsset(resolve(v.out),Buffer.from(encodeWav(channels)));
  console.log(JSON.stringify({file:resolve(v.out),...report}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e=>{console.error(e.message);process.exitCode=1});
}
