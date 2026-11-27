import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FootstepWalker, contactSamples } from '../engine/footsteps.ts';
import { activeRms, renderSound } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';
import { renderRoute, surfaces } from '../scripts/footsteps.mjs';
import { loadRecipes, ROOT } from '../scripts/recipes.mjs';
import { decodeWav, inspect } from './metrics.mjs';

const ids = surfaces.map(surface => 'stride-' + surface);
const collection = await loadRecipes(new Set(ids));
const recipe = Object.fromEntries(collection.map(r => [r.id.slice(7), r]));
const flags = ['--experimental-strip-types','--disable-warning=ExperimentalWarning'];
const energy = pcm => pcm.reduce((sum, x) => sum + x * x, 0);
const cli = (...args) => execFileSync(process.execPath, [...flags,'scripts/footsteps.mjs',...args],
  {cwd:ROOT, encoding:'utf8', stdio:['ignore','pipe','pipe']});

test('agent search routes a repeating step to its surface and movement tools', () => {
  for (const surface of ['gravel','metal-stairs','snow','mud','sand']) {
    const query = 'alternating ' + surface.replaceAll('-', ' ') + ' footsteps';
    const run = execFileSync(process.execPath, ['scripts/choose.mjs',query], {cwd: ROOT});
    const {cues} = JSON.parse(run);
    assert.equal(cues[0].id, recipe[surface].id);
    assert.equal(cues[0].movement.takeCount, recipe[surface].takeCount);
    assert.equal(cues[0].movement.eventsPerPlant, 1);
  }
});

test('each foot exhausts its own recorded pool and crosses refill boundaries without a repeat', () => {
  assert.deepEqual(Object.fromEntries(collection.map(r => [r.id.slice(7),r.takeCount])),
    {hardwood:12, concrete:10, gravel:8, grass:8, puddle:9, 'metal-stairs':7, snow:9, mud:5, sand:7});
  for (const r of collection) {
    const w = new FootstepWalker(7), feet = [[], []];
    for (let i = 0; i < 60; i++) {
      const hit = w.plant(r), side = i % 2;
      assert.equal(hit.foot, side ? 'right' : 'left');
      assert.equal(hit.take % 2, side);
      assert.notEqual(hit.take, feet[side].at(-1));
      feet[side].push(hit.take);
    }
    for (const [side, takes] of feet.entries()) {
      const n = Math.floor((r.takeCount + 1 - side) / 2);
      for (let i = 0; i+n <= takes.length; i += n) assert.equal(new Set(takes.slice(i,i+n)).size, n);
    }
  }
});

test('one plant per grounded marker and continuous side history across surfaces', () => {
  const w = new FootstepWalker(31), reference = new FootstepWalker(31);
  const a = {eventId:'character:cycle1:0',foot:'right'};
  assert.equal(w.plant(recipe.grass, {...a, grounded:false}), null);
  assert.throws(() => w.plant(recipe.grass, {...a,actor:{x:NaN,z:0}}));
  assert.deepEqual(w.plant(recipe.grass,a), reference.plant(recipe.grass,a));
  assert.equal(w.plant(recipe.grass,a), null);
  const b = w.plant(recipe.hardwood);
  assert.deepEqual(b, reference.plant(recipe.hardwood));
  assert.equal(b.foot, 'left');
  const plantedRightOnLeft = w.plant(recipe.hardwood, {foot:'right',contactPosition:{x:-2,z:-1}});
  assert.ok(plantedRightOnLeft.pan < -.5);
});

test('every surface take passes onset, peak and active loudness across gait and parameter extremes', () => {
  for (const r of collection) {
    for (const setting of ['default','min','max']) {
      const params = Object.fromEntries(Object.entries(r.params).map(([key, p]) => [key,p[setting]]));
      for (let take = 0; take < r.takeCount; take++) {
        const pcm = decodeWav(encodeWav(renderSound(r, {seed:take,params})),44100);
        for (const [k,v] of Object.entries(inspect(pcm,r,44100))) {
          if (v) assert.ok(v.pass, JSON.stringify({id:r.id,setting,take,k,v}));
        }
      }
    }
  }
});

test('material level, gait, footwear, wetness and pivots survive rendering', () => {
  function plant(r, input) { return new FootstepWalker(90).plant(r,input); }
  const dry = plant(recipe.hardwood,{}), pcm = contactSamples(dry);
  const db = x => 20 * Math.log10(activeRms(contactSamples(x),44100) * x.gain);
  assert.ok(db(dry) - db(plant(recipe.grass,{})) > 8);
  assert.ok(db(plant(recipe.hardwood,{gait:'sprint'})) - db(plant(recipe.hardwood,{gait:'sneak'})) > 7);
  for (const control of [{footwear:'boot'}, {wetness:1}, {travel:'backward'}, {motion:'pivot'}, {weight:1}]) {
    const alt = plant(recipe.hardwood,control);
    assert.equal(alt.take,dry.take);
    const diff = contactSamples(alt).map((x,i) => x-pcm[i]);
    assert.ok(energy(diff) > energy(pcm)*.002, JSON.stringify(control));
  }
});

test('authored routes reproduce stereo movement, requested event count and entry/stop', async () => {
  const route = [{surface:'gravel',steps:10,gait:'sprint',from:{x:-4,z:-1},to:{x:4,z:-1}}];
  const a = await renderRoute(route,31), b = await renderRoute(route,31);
  assert.deepEqual(a.events,b.events);
  assert.deepEqual(a.channels,b.channels);
  assert.equal(a.events.length,10);
  assert.deepEqual(a.events.map(e => e.motion), ['push-off', ...Array(8).fill('steady'), 'brake']);
  const c = await renderRoute(route,102);
  assert.notDeepEqual(c.events.map(e=>e.take),a.events.map(e=>e.take));
  const [left,right] = a.channels, last = a.events.at(-1).frame;
  assert.ok(energy(left.subarray(0,8000)) > 4*energy(right.subarray(0,8000)));
  assert.ok(energy(right.subarray(last)) > 4*energy(left.subarray(last)));
  assert.ok(a.peakDbfs <= -1);
  const turned = await renderRoute([{...route[0],listener:{x:0,z:0,yaw:Math.PI}}],31);
  for (const [i,e] of turned.events.entries()) assert.ok(Math.abs(e.pan + a.events[i].pan) < 1e-6);
  const one = await renderRoute([{surface:'hardwood',steps:1,firstFoot:'right'}]);
  assert.equal(one.events.length,1);
  assert.equal(one.events[0].foot,'right');
  assert.equal(one.events[0].motion,'steady');
  assert.ok(one.events[0].pan > 0 && one.events[0].pan < .12);
  await assert.rejects(renderRoute([{surface:'hardwood',steps:0}]));
  await assert.rejects(renderRoute([{surface:'gravel',steps:1,from:{x:0,z:0}}]));
});

test('a surface boundary keeps phase and cadence; an authored gait ramp changes effort over the requested plants', async () => {
  const terrain = ['metal-stairs','snow','mud','sand'];
  const uniform = terrain.map(surface => ({surface,steps:3,gait:'walk'}));
  const seed = 109;
  const {events} = await renderRoute(uniform,seed);
  const control = await renderRoute([{surface:'hardwood',steps:12}],seed);
  assert.deepEqual(events.map(e => [e.frame,e.foot]),control.events.map(e => [e.frame,e.foot]));
  const incoming = {surface:'mud',steps:6,gait:'sprint'};
  const before = {surface:'snow',steps:4,gait:'walk'};
  const ramp = (await renderRoute([before,{...incoming,transitionSteps:3}],seed)).events;
  const abrupt = (await renderRoute([before,incoming],seed)).events;
  const gap = (arr,i) => arr[i+1].frame - arr[i].frame;
  for (const i of [4,5]) {
    assert.ok(gap(ramp,i) > gap(abrupt,i));
    assert.ok(ramp[i].gain < abrupt[i].gain);
    assert.ok(gap(ramp,i) > gap(ramp,i+1));
  }
  assert.ok(Math.abs(gap(ramp,6)-gap(abrupt,6)) <= 1);
  assert.equal(ramp[6].gain,abrupt[6].gain);
  await assert.rejects(renderRoute([before,{...incoming,transitionSteps:7}],seed));
});

test('stair treads retain low body and a restrained top end in light and heavy plants', () => {
  const stair = recipe['metal-stairs'];
  for (const gait of [0,.5,1]) for (const boot of [0,1]) for (let take=0;take<stair.takeCount;take++) {
    const params = {gait,boot,weight:boot,wetness:boot,scuff:boot};
    const checks = inspect(renderSound(stair,{seed:take,params}),stair,44100);
    assert.ok(checks.spectrum.pass);
    assert.ok(checks.spectrum.highAbove4kHzShare < .16);
  }
});

test('native export gives distinct mono files per side and preserves an existing bank on conflict', async () => {
  const dir = await mkdtemp(join(tmpdir(),'lumina-movement-test-'));
  try {
    const bank = join(dir,'takes');
    const args = ['--surface','puddle','--bank',bank];
    const manifest = JSON.parse(cli(...args));
    assert.equal(manifest.takes.length,9);
    assert.equal(manifest.credits[0].license,'CC0-1.0');
    const before = new Map();
    for (const item of manifest.takes) {
      const bytes = await readFile(join(bank,item.file));
      assert.equal(bytes.readUInt16LE(22),1);
      assert.equal(bytes.readUInt32LE(24),44100);
      assert.equal(item.take % 2, item.foot === 'right' ? 1 : 0);
      before.set(item.file,bytes);
    }
    assert.equal(new Set([...before.values()].map(b=>b.toString('base64'))).size,9);
    assert.deepEqual(JSON.parse(cli(...args)),manifest);
    assert.throws(() => cli(...args,'--gait','sprint'), /Existing bank differs/);
    for (const [name, bytes] of before) assert.deepEqual(await readFile(join(bank,name)),bytes);
    assert.deepEqual(await readdir(dir),['takes']);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('headphone routes distinguish front from rear on the same dry take and follow the listener heading', async () => {
  const route = (x, z, yaw = 0) => [{surface:'hardwood',steps:1,firstFoot:'left',
    from:{x:x+.13,z,yaw:0},to:{x:x+.13,z,yaw:0},listener:{x:0,z:0,yaw,earHeightM:1.5}}];
  const render = (x,z,yaw,output='headphones') => renderRoute(route(x,z,yaw),72,output);
  const [front, rear, rotated, right, left] = await Promise.all([
    render(0,-2,0), render(0,2,0), render(0,-2,Math.PI), render(2,0,0), render(-2,0,0)]);
  assert.equal(front.events[0].take,rear.events[0].take);
  assert.ok(energy(front.channels[0].map((v,i) => v-rear.channels[0][i])) > energy(front.channels[0]) * .1);
  assert.ok(energy(rear.channels[0].map((v,i) => v-rotated.channels[0][i])) < energy(rear.channels[0]) * 1e-9);
  assert.ok(energy(right.channels[1]) > 2*energy(right.channels[0]));
  assert.ok(energy(left.channels[0]) > 2*energy(left.channels[1]));
  const [a,b] = await Promise.all([render(0,-2,0,'stereo'),render(0,2,0,'stereo')]);
  assert.deepEqual(a.channels,b.channels);
  assert.equal(a.events[0].gain,front.events[0].gain);
  assert.ok(front.channels[0].length > a.channels[0].length);
  await assert.rejects(renderRoute(route(0,1),72,'binaurall'), /output/);
});
