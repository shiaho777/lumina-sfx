import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadDesign } from '../scripts/remix-design.mjs';
import { composeListeningScene } from '../engine/listening-scene.ts';
import { poseAt, relativePose, placeAudio, validatePlacement } from '../engine/spatial.ts';
import { headphoneFilter } from '../engine/headphones.ts';
import { renderChannels } from '../engine/render.ts';
import { resolveListeningBrief } from '../scripts/listening-brief.mjs';
const read = (n) =>
  readFile(new URL('../references/listening-scenes/' + n + '.json', import.meta.url), 'utf8').then(
    JSON.parse,
  );
const rate = 16000,
  ear = { position: [0, 0, 0] },
  p = { position: [1, 0, -1] };
const energy = (c) => c.reduce((s, x) => s + x * x, 0);
function run(design, layers) {
  let capture;
  const recipe = composeListeningScene(
    { schemaVersion: 2, id: 'fixture', ...design },
    layers,
    headphoneFilter,
    (x) => {
      capture = x;
    },
  );
  const channels = renderChannels(recipe, {}, rate);
  return { channels, ...capture };
}
const tone = {
  id: 'test-tone',
  name: 'Tone',
  category: 'ui',
  tags: [],
  loopable: false,
  durationSec: 1,
  params: {},
  render(ctx, { seed }) {
    const hz = 450 + (seed % 61);
    return Float32Array.from(
      { length: ctx.frames },
      (_, i) => 0.1 * Math.sin((i * 2 * Math.PI * hz) / ctx.sampleRate),
    );
  },
};
const layer = (label, extra = {}) => ({ recipe: tone, label, event:label, ...extra });
test('focus works against the sum, across array order, when the named source is a loop', async () => {
  const design = await read('cockpit-engine');
  let a, b;
  const { recipe } = await loadDesign(design, undefined, undefined, (s) => (a = s));
  const mix = renderChannels(recipe, {}, rate);
  const { recipe: other } = await loadDesign(
    { ...design, layers: [...design.layers].reverse() },
    undefined,
    undefined,
    (s) => (b = s),
  );
  assert.deepEqual(renderChannels(other, {}, rate), mix);
  const r = a.regions[0];
  assert.ok(r.measuredBeforeDb < 0);
  assert.ok(r.delivered.marginDb > 7.9);
  assert.ok(Number.isFinite(r.delivered.phoneMarginDb));
  assert.deepEqual(
    a.stems.map((s) => s.dry),
    b.stems.map((s) => s.dry),
  );
});
test('one edit preserves timestamps, take and absolute foreground level', () => {
  const layers = [layer('foot', { offsetSec: 0.25 }), layer('wind', { gain: 0.8, locked: true })];
  const a = run({ balance:'directed', focus: { subjects: ['foot'] } }, layers);
  const b = run({ balance:'directed', focus: { subjects: ['foot'] } }, [
    ...layers.slice(0, 1),
    layer('wind', { gain: 0.15, locked: true }),
  ]);
  assert.deepEqual(a.stems[0].dry, b.stems[0].dry);
  assert.equal(b.stems[0].offset, 0.25 * rate);
  assert.equal(a.regions[0].gain.wind, 1);
  assert.ok(a.regions[0].conflicts.length);
  const late = run({}, [layer('click', { offsetSec: 0.25 })]).channels[0];
  assert.ok(late.subarray(0, 0.25 * rate).every((x) => x === 0));
  assert.ok(energy(late.subarray(0.25 * rate)) > 0);
});
test('explicit no focus, shared focus, handoff, unknown labels and bad keyframes', () => {
  const layers = [layer('a', { gain: 0.25 }), layer('b')];
  const shared = run({ balance:'directed', focus: { subjects: ['a', 'b'] } }, layers);
  assert.ok(shared.regions[0].gain.b < 0.3);
  const ambient = run({ focus: { subjects: [] } }, layers);
  assert.deepEqual(Object.values(ambient.regions[0].gain), [1, 1]);
  const switched = run(
    { focus: { subjects: ['a'], moments: [{ from: 0.35, to: 0.65, subjects: ['b'] }] } },
    layers,
  );
  assert.deepEqual(
    switched.regions.map((r) => r.subjects[0]),
    ['a', 'b', 'a'],
  );
  assert.ok(switched.regions[0].gain.b < 1 && switched.regions[1].gain.b === 1);
  assert.throws(() => run({ focus: { subjects: ['c'] } }, layers));
  assert.throws(() => validatePlacement({ position: [0, 0, 1], path: [{ at: -1, position: [1, 2, 3] }] }));
  assert.throws(() =>
    run({ focus: { subjects: ['a'], moments: [{ from: 0.8, to: 2, subjects: ['b'] }] } }, layers),
  );
});
test('distance, directivity, head turn, width, headlocked UI and mono', () => {
  const src = Float32Array.from({ length: rate }, (_, i) => Math.sin((2 * Math.PI * 650 * i) / rate));
  const place = (p, l = ear, mode = 'stereo') => placeAudio([src], p, l, mode, rate, 0);
  const [l, r] = place(p);
  assert.ok(energy(r) > 3 * energy(l));
  const rotated = place(p, { ...ear, yaw: 135 });
  assert.ok(energy(rotated[0]) > 4 * energy(rotated[1]));
  assert.equal(relativePose({ position: [0, 0, -10] }, ear, 0).gain, 0.1);
  const cone = { kind: 'cone', position: [0, 0, -2], outerGain: 0.1 };
  assert.ok(relativePose({ ...cone, yaw: 180 }, ear, 0).gain > 8 * relativePose(cone, ear, 0).gain);
  const locked = place({ kind: 'listener' }, { ...ear, yaw: 170 }, 'headphones');
  assert.deepEqual(locked, [src, src]);
  const m = place(p, ear, 'mono');
  assert.equal(m.length, 1);
  assert.ok(energy(m[0]) > 0);
  const area = placeAudio(
    [src, src.map((x) => -x)],
    { kind: 'area', position: [0, 0, -1], spread: 1 },
    ear,
    'stereo',
    rate,
    0,
  );
  assert.ok(energy(area[0]) > 1000);
  assert.equal(area[0][400], -area[1][400]);
});
test('measured HRIR conveys sided arrival, front/back and elevation in headphones', () => {
  const peakTime = (c) => c.indexOf(c.reduce((a, b) => (Math.abs(a) > Math.abs(b) ? a : b)));
  for (const r of [16000, 44100, 48000]) {
    const [l, right] = headphoneFilter(90, 0, r);
    assert.ok(energy(right) > energy(l) * 2);
    assert.ok(peakTime(right) < peakTime(l));
    const src = new Float32Array(r / 10);
    src[0] = 1;
    const at = (pos) => placeAudio([src], { position: pos }, ear, 'headphones', r, 0, headphoneFilter)[0];
    assert.notDeepEqual(at([0, 0, -1]), at([0, 0, 1]));
    assert.notDeepEqual(at([0, 1, 0]), at([0, -1, 0]));
  }
});
test('relative motion preserves pitch on parallel paths and shifts opposite ways on a pass', () => {
  const input = Float32Array.from({ length: rate }, (_, i) => Math.sin((2 * Math.PI * 600 * i) / rate));
  const moving = {
    position: [0, 0, -22],
    path: [
      { at: 0.5, position: [0, 0, -2] },
      { at: 1, position: [0, 0, -22] },
    ],
    doppler: true,
    rolloff: 0,
    air: 0,
  };
  const frequency = (samples, a, b) => {
    let crossings = 0;
    for (let i = a * rate; i < b * rate; i++) if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
    return crossings / (b - a);
  };
  const [out] = placeAudio([input], moving, ear, 'stereo', rate, 0);
  assert.ok(frequency(out, 0.125, 0.375) > 640);
  assert.ok(frequency(out, 0.625, 0.875) < 565);
  const [steady] = placeAudio(
    [input],
    moving,
    {
      ...moving,
      position: [0, 0, -21],
      path: [
        { at: 0.5, position: [0, 0, -1] },
        { at: 1, position: [0, 0, -21] },
      ],
    },
    'stereo',
    rate,
    0,
  );
  assert.ok(Math.abs(frequency(steady, 0.125, 0.375) - 600) <= 4);
});
test('doorway movement is reversible, stable and attenuates high frequencies', () => {
  const position = [1, 0, 0],
    obstruction = [
      [0, 1],
      [0.1, 1],
      [0.3, 0],
      [0.65, 0],
      [0.85, 1],
      [1, 1],
    ];
  const src = Float32Array.from({ length: rate }, (_, i) => Math.sin((2 * Math.PI * 5000 * i) / rate));
  const [a, b] = placeAudio([src], { position, room: 'hangar', obstruction }, ear, 'stereo', rate, 0);
  const window = (x, t) => x.subarray(t * rate, (t + 0.05) * rate);
  assert.ok(energy(window(b, 0.45)) > 4 * energy(window(b, 0.9)));
  assert.ok(a.every(Number.isFinite));
});
test('agent intent resolves the viewpoint without changing an explicit subject', async () => {
  const bank = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url))).sounds;
  const brief = await read('pilot.brief');
  const a = resolveListeningBrief(brief, bank);
  assert.equal(a.design.layers[0].id, 'interceptor-turbofan-canopy-interior-cruise-loop');
  const b = resolveListeningBrief(
    { ...brief, layers: [...brief.layers].reverse(), focus: { subjects: ['thunder'] } },
    bank,
  );
  assert.deepEqual(b.design.focus.subjects, ['thunder']);
  assert.deepEqual(b.design.layers, [...a.design.layers].reverse());
  const c = resolveListeningBrief({ ...brief, layers: [{ label: 'fake', query: 'imaginaryxxxx' }] }, bank);
  assert.equal(c.decision, 'review');
  assert.equal(c.design, null);
});

test('a targeted competing-band cut is applied before measuring or exporting dry stems', () => {
  const base = [layer('engine'), layer('rain')];
  const a = run({}, base),
    b = run({}, [base[0], layer('rain', { maskEq: { hz: 480, cutDb: 6, q: 0.8 } })]);
  assert.deepEqual(a.stems[0].dry, b.stems[0].dry);
  assert.ok(energy(a.stems[1].dry[0]) > 3.2 * energy(b.stems[1].dry[0]));
});

test('a single physical scene preserves its engine, delays thunder and contains only the requested sources', async () => {
  const shot = await read('pilot-inside-canopy'), dry = await read('dry-cockpit');
  async function snapshot(design) {
    let scene;
    const {recipe} = await loadDesign(design, undefined, undefined, value=>scene=value);
    renderChannels(recipe, {}, rate);
    return scene;
  }
  const storm = await snapshot(shot), clear = await snapshot(dry);
  const byLabel = label => storm.stems.find(s=>s.label===label);
  assert.deepEqual(storm.stems.map(x=>x.label),['jet','rain','thunder']);
  assert.deepEqual(byLabel('jet').ears,clear.stems[0].ears);
  assert.ok(Math.abs(byLabel('thunder').offset / rate - 2.85)<1/rate);
  assert.deepEqual(Object.values(storm.regions[0].gain), [1,1,1]);
  assert.ok(storm.regions[0].delivered.marginDb > 2);
  const close = structuredClone(shot);
  close.layers.find(l=>l.label==='thunder').acoustics.distanceM=60;
  const near=(await snapshot(close)).stems.find(s=>s.label==='thunder');
  assert.ok(near.offset<byLabel('thunder').offset-rate);
  assert.ok(energy(near.ears[0])>3*energy(byLabel('thunder').ears[0]));
  const orbit=await snapshot(await read('orbit-and-turn'));
  assert.deepEqual(orbit.stems.map(s=>s.label),['turbine']);
});

test('clean scenes enforce physical identity and permit distinct overlapping emitters', () => {
  const recipe={...tone,isolation:'isolated',components:['rain']};
  const one={recipe,label:'roof'},two={recipe:{...recipe,id:'second-rain'},label:'glass'};
  assert.throws(()=>run({balance:'natural'},[one,two]),/Overlapping copies/);
  assert.doesNotThrow(()=>run({balance:'natural'},[{...one,event:'front'}, {...two,event:'rear'}]));
  assert.doesNotThrow(()=>run({balance:'natural'},[one,{...two,offsetSec:1.1}]));
  assert.throws(()=>run({scope:'world'},[{recipe:{...tone,mixRole:'interface'}}]),/interface cue/);
  assert.throws(()=>run({sourcePolicy:'clean'},[layer('field')]),/isolated source/);
  assert.doesNotThrow(()=>run({},[{recipe: tone, gain:4,acoustics:{source:'turbine',distanceM:3}}]));
});

test('a natural pilot brief infers paths only for requested sources and rejects duplicate rain',async()=>{
  const {sounds}=JSON.parse(await readFile(new URL('../catalog.json',import.meta.url)));
  const brief={schemaVersion:2,id:'brief-check',viewpoint:'inside the cockpit',focus:{subjects:['jet']},
    layers:[{label:'jet',query:'interceptor-turbofan-canopy-interior-cruise-loop'}]};
  const {design}=resolveListeningBrief(brief,sounds);
  assert.equal(design.balance,'natural');assert.equal(design.sourcePolicy,'clean');
  assert.equal(design.layers.length,1); assert.ok(design.layers[0].acoustics.distanceM<5);
  const rain={label:'rain',query:'rain-canopy-droplets-clean-loop'};
  const duplicate=resolveListeningBrief({...brief,layers:[...brief.layers,rain,{...rain,label:'patter'}]},sounds);
  assert.equal(duplicate.decision,'review');assert.match(duplicate.missing[0].reason,/overlapping/);
  assert.equal(resolveListeningBrief(brief,sounds.map(s=>({...s,cleanHold:['speech']}))).decision,'review');
});

test('a moving listener hears the discrete event from its emission position', async()=>{
  const {resolveEmitter}=await import('../engine/acoustic-emitter.ts');
  const result=resolveEmitter({recipe:tone,acoustics:{source:'thunder'},
    placement:{position:[686,0,0],path:[{at:3,position:[0,0,0]}]}},
    {position:[0,0,0],path:[{at:3,position:[1029,0,0]}]});
  assert.equal(result.arrival.travelSec,1);
  assert.deepEqual(result.placement.position,[686,0,0]);
  assert.equal(result.placement.path,undefined);
});

test('named directions use the listener orientation at emission and retain distance', () => {
  for (const [direction, bearingDeg, elevationDeg] of [['overhead',0,90],['below',0,-90],['rear-left',-135,0],['front-right',45,0]]) {
    const listener = {position:[4,2,1],yaw:36,pitch:8};
    const sound = acoustics => run({listener}, [{recipe:tone,label:'signal',acoustics:{distanceM:8,...acoustics}}]);
    const named = sound({direction}), numeric = sound({bearingDeg,elevationDeg});
    assert.deepEqual(named.stems[0].placement.position, numeric.stems[0].placement.position);
    assert.ok(Math.abs(named.stems[0].arrival.distanceM - 8) < 1e-8);
    assert.throws(() => sound({direction,bearingDeg}), /direction or numeric/);
  }
});

test('phone monitoring distinguishes an immovable masker from an adjustable contributor', async () => {
  const { monitorFocus } = await import('../engine/focus-monitor.ts');
  const make = (label, hz, amplitude, locked = false) => {
    const signal = Float32Array.from({length: rate}, (_,i) => amplitude * Math.sin(2*Math.PI*hz*i/rate));
    return {label, locked, offset:0, ears:[signal,signal]};
  };
  for (const reachable of [false,true]) {
    const stems = [make('subject',845,.1),make('fixed',610,reachable ? .064 : .35,true),make('secondary',1090,.055)];
    const region = {from:0,to:1,subjects:['subject'],marginDb:3,gain:{subject:1,fixed:1,secondary:1}};
    const result = monitorFocus(stems,region,rate,true);
    assert.equal(region.gain.fixed,1);
    if (reachable) {
      assert.ok(region.gain.secondary<1);
      assert.ok(result.views.phone.p10Db >= 3);
    } else {
      assert.equal(region.gain.secondary,1);
      assert.equal(result.views.phone.worst.masker,'fixed');
    }
  }
});

test('one event, vehicle state, exact ID and source markers survive free-text source selection',async()=>{
  const {sounds}=JSON.parse(await readFile(new URL('../catalog.json',import.meta.url),'utf8'));
  const choose=(query,extra={})=>resolveListeningBrief({schemaVersion:2,scope:'world',layers:[{query,label:'source',...extra}]},sounds);
  const single=choose('one thunder strike');
  assert.equal(single.design.layers[0].id,'thunder-isolated-rolling-strike');
  assert.equal(choose('city bus diesel engine cruising at constant speed',{durationSec:8}).design.layers[0].id,'transit-bus-steady-cruise-loop');
  assert.equal(choose('jet turbine at steady low throttle taxiing on an airfield',{durationSec:8}).design.layers[0].id,'light-jet-taxi-thrust-loop');
  assert.equal(choose('light-jet-taxi-thrust-loop',{fromMarker:'not-a-marker'}).decision,'review');
  assert.equal(choose('thunder-isolated-rolling-strike',{durationSec:30}).decision,'review');
  assert.equal(choose('hydrogen bus pneumatic door closing at highway speed').decision,'review');
  assert.equal(choose('one motorcycle engine',{durationSec:8}).design.layers[0].id,'motorcycle-steady-engine-loop');
});

test('a camera cut keeps a continuous source on its clock and never imparts a Doppler jump', () => {
  const cut = 0.4276;
  const listener = {position: [-2,0,0], path: [{at: cut, position:[18,0,0], cut: true}]};
  assert.deepEqual(poseAt(listener, cut - .001).position, [-2,0,0]);
  assert.deepEqual(poseAt(listener, cut).position, [18,0,0]);
  const src = Float32Array.from({length:rate}, (_,i) => Math.sin(2 * Math.PI * 650 * i / rate));
  const place = (doppler, observer) => placeAudio([src], {position:[0,0,-1], refDistance:2, doppler}, observer, 'stereo', rate, 0);
  const expected = place(false, listener), actual = place(true, listener);
  assert.deepEqual(actual, expected);
  const boundary = Math.ceil(cut * rate);
  const fixed = place(false, {position: listener.position});
  for (let ch = 0; ch < 2; ch++) {
    assert.deepEqual(actual[ch].subarray(0,boundary), fixed[ch].subarray(0,boundary));
    assert.ok(energy(actual[ch].subarray(boundary + 200)) > 0);
  }
  assert.ok(energy(actual[1].subarray(0,boundary)) > 3 * energy(actual[0].subarray(0,boundary)));
  assert.ok(energy(actual[0].subarray(boundary+200)) > 3 * energy(actual[1].subarray(boundary+200)));
  assert.throws(() => validatePlacement({path:[{at:1, position:[1,0,1], cut:'yes'}]}));
});

test('the downloadable cut scene accepts both viewpoints through the public design loader', async () => {
  const spec = await read('porch-to-roadside');
  const { recipe } = await loadDesign(spec);
  assert.equal(recipe.id, spec.id);
  const bad = structuredClone(spec);
  bad.listener.path[0].cut = 'off';
  await assert.rejects(() => loadDesign(bad), /boolean cut/);
});

test('an unresolved brief preserves eligible siblings and explains the missing material or policy', async () => {
  const {sounds} = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
  const key = 'stride-gravel', roof = 'corrugated-metal-roof-rain-loop';
  const make = query => ({ schemaVersion:2, scope:'world', layers:[{label:'roof',query:roof},{label:'walker',query}] });
  const cut = resolveListeningBrief(make(key),sounds,{useCase:'shelter',votes:{[key]:{decision:'no',
    revision:sounds.find(s=>s.id===key).revision, useCase:'shelter'}}});
  assert.equal(cut.decision,'review');assert.equal(cut.design,null);
  assert.deepEqual(cut.resolvedLayers,[{label:'roof',id:roof}]);assert.equal(cut.missing[0].candidates[0].issue,'project-rejected');
  const held = resolveListeningBrief(make(key),sounds.map(s=>s.id===key?{...s,isolation:undefined}:s));
  assert.equal(held.missing[0].candidates[0].issue,'needs-isolation');
  const absent = resolveListeningBrief(make('gravel footstep through cellophane'),sounds);
  assert.equal(absent.design,null);assert.ok(absent.missing[0].candidates.some(c=>c.missingTerms.includes('cellophane')));
});

test('local focus lowers a brief burst while leaving the quieter portions of the same bed audible', () => {
  const bed = { ...tone, id: 'long-running-bed', loopable: true, durationSec: 4 };
  const layers = [
    { recipe: { ...bed, id: 'motor-subject' }, label: 'motor', gain: 0.45 },
    { recipe: bed, label: 'weather', envelope: [[0,0.07],[1.41,0.07],[1.46,1],[1.97,1],[2.02,0.07],[4,0.07]] },
  ];
  const focus = { subjects: ['motor'], marginDb: 6 };
  const steady = run({ balance:'directed', focus }, layers);
  const local = run({ balance:'directed', focus:{ ...focus, timing:'local' } }, layers);
  assert.equal(steady.regions.length, 1);
  assert.ok(local.regions.length >= 3);
  const gainsAt = t => local.regions.find(r => r.from <= t && r.to > t).gain;
  assert.equal(gainsAt(0.65).weather, 1);
  assert.equal(gainsAt(3.1).weather, 1);
  assert.ok(gainsAt(1.7).weather < 0.4);
  assert.deepEqual(local.regions.map(r => r.gain.motor), local.regions.map(() => 1));
  assert.deepEqual(local.stems.map(s => s.dry), steady.stems.map(s => s.dry));
  const locked = run({ balance:'directed', focus:{ ...focus, timing:'local' } }, [layers[0], {...layers[1], locked:true}]);
  assert.ok(locked.regions.every(r => r.gain.weather === 1));
});

test('the installable design reads local timing from a directed brief and its authored handoff', async () => {
  const {sounds} = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
  const brief = { schemaVersion:2, id:'brief-timing', focus:{subjects:['motor'],marginDb:4,
    moments:[{from:0.4,to:0.8,subjects:['rain'],timing:'steady'}]},
    layers:[{label:'motor',query:'interceptor-turbofan-dry-thrust-cruise-loop',durationSec:1},
            {label:'rain',query:'rain-canopy-droplets-clean-loop',durationSec:1}] };
  const {design} = resolveListeningBrief(brief,sounds);
  assert.equal(design.focus.timing,'local');
  const {recipe}=await loadDesign(design);
  assert.ok(renderChannels(recipe,{},16000)[0].some(n=>n!==0));
  await assert.rejects(()=>loadDesign({...design,focus:{...design.focus,timing:'bad'}}),/focus timing/);
});
