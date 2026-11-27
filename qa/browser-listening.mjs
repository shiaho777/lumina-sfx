// Optional browser rehearsal. Supply an installed Playwright module and Chrome executable.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parseArgs } from 'node:util';
import ts from 'typescript';
const { chromium } = await import(process.env.LUMINA_PLAYWRIGHT ?? 'playwright');
const root = new URL('../engine/', import.meta.url);
const { values, positionals } = parseArgs({ allowPositionals: true, options: { windows: {type:'string'} } });
const [prepared] = positionals;
if (positionals.length > 1 || (values.windows && !prepared)) throw Error('Supply a scene pack and optionally --windows expected.json');
const checkedWindows = values.windows ? JSON.parse(await readFile(values.windows, 'utf8')) : [
  {from:0.15,to:0.5,side:'left'}, {from:2.3,to:2.6,side:'right'},
];
if (!Array.isArray(checkedWindows) || !checkedWindows.length || checkedWindows.some(w =>
  !Number.isFinite(w.from) || !Number.isFinite(w.to) || w.from < 0 || w.to <= w.from ||
  !['left','right','quiet','audible'].includes(w.side))) throw Error('Supply expected windows with from, to and side');
const manifest = prepared && JSON.parse(await readFile(join(prepared,'scene.json'),'utf8'));
const packFrames = manifest ? Math.ceil(manifest.frames / manifest.rate * 44100) : 0;
if (prepared && checkedWindows.some(w => w.to > packFrames / 44100)) throw Error('Probe window exceeds scene duration');
const meter = `class SceneMeter extends AudioWorkletProcessor {
  constructor(){super();this.first=null;this.last=null;this.gaps=0;this.zeroFrames=0;this.sum=0;this.peak=0;}
  process(inputs,outputs){
    const c=inputs[0]?.[0]; if(c){let energy=0;
      for(let i=0;i<c.length;i++) {energy+=c[i]*c[i];this.peak=Math.max(this.peak,Math.abs(c[i]));}
      if(energy>1e-10){if(this.first===null)this.first=currentFrame;this.last=currentFrame;this.gaps+=this.zeroFrames;this.zeroFrames=0;}
      else if(this.first!==null)this.zeroFrames+=c.length;
      this.sum+=energy;
    }
    if(currentFrame%2048===0)this.port.postMessage({first:this.first,last:this.last,peak:this.peak,gapFrames:this.gaps,energy:this.sum});
    return true;
  }
};registerProcessor('scene-meter',SceneMeter);`;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><title>Lumina browser QA</title>');
      return;
    }
    if (path === '/meter.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(meter);
      return;
    }
    if (['/live-listening.js', '/spatial.js'].includes(path)) {
      res.setHeader('Content-Type', 'text/javascript');
      const filename = path.slice(1).replace('.js', '.ts');
      const code = await readFile(prepared ? join(prepared, filename) : new URL(filename, root), 'utf8');
      res.end(
        ts
          .transpileModule(code, {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
          })
          .outputText.replaceAll("'./spatial.ts'", "'./spatial.js'"),
      );
      return;
    }
    if (prepared && path.startsWith('/pack/')) {
      const file = basename(path);
      res.end(await readFile(join(prepared, file)));
      return;
    }
    res.statusCode = 404;
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.end(e.message);
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.LUMINA_CHROME ?? undefined,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  const results = await page.evaluate(async ({prepared, checkedWindows, packFrames}) => {
    const { ListeningPlayer, prepareHeadphones } = await import('/live-listening.js');
    const result = [];
    const ctx = new AudioContext({ sampleRate: 44100, latencyHint: 'interactive' });
    const start = performance.now();
    await ctx.resume();
    await ctx.audioWorklet.addModule('/meter.js');
    const unlockMs = performance.now() - start;
    let time = 1.15;
    for (const mode of ['headlocked', 'stereo', 'headphones', 'directed-game'])
      for (const count of mode === 'directed-game' ? [32] : [1, 8, 32]) {
        const meter = new AudioWorkletNode(ctx, 'scene-meter');
        meter.connect(ctx.destination);
        let stats;
        meter.port.onmessage = (e) => (stats = e.data);
        const r = ctx.sampleRate,
          b = ctx.createBuffer(1, Math.round(r * time), r);
        const pcm = b.getChannelData(0);
        for (let i = 0; i < pcm.length; i++) pcm[i] = 0.12 * Math.sin((i * 2 * Math.PI * 810) / r);
        const sources = Array.from({ length: count }, (_, i) => ({
          label: 's' + i,
          offsetSec: 0,
          dry: { file: 'fixture.wav', restoreGain: 1 / count },
          placement:
            mode === 'headlocked'
              ? { kind: 'listener' }
              : { kind: 'point', position: [-1, 0, -2], path: [{ at: time, position: [1, 0, -2] }] },
        }));
        const gains = Object.fromEntries(sources.map((s) => [s.label, 1]));
        const manifest = {
          schemaVersion: 2,
          rate: r,
          frames: pcm.length,
          listener: { position: [0, 0, 0] },
          output: ['headphones', 'directed-game'].includes(mode) ? 'headphones' : 'stereo',
          balance: mode === 'directed-game' ? 'directed' : 'natural',
          sources,
          regions: [{ from: 0, to: time, gain: gains, subjects: ['s0'], marginDb: 6 }],
        };
        const player = new ListeningPlayer(ctx, manifest, new Map(sources.map((s) => [s.label, b])), meter);
        const warmStart = performance.now();
        if (mode === 'headphones') await prepareHeadphones(r);
        const warmupMs = performance.now() - warmStart;
        const before = performance.now(),
          when = ctx.currentTime + 0.035;
        player.play(when);
        const setupMs = performance.now() - before;
        const frames = [], updateMs = [];
        let prev = performance.now(),
          raf;
        const tick = (t) => {
          frames.push(t - prev);
          prev = t;
          if (mode === 'directed-game' && ctx.currentTime >= when && ctx.currentTime < when + time) {
            const beforeMove = performance.now();
            player.setListener({position: [Math.sin(4 * (ctx.currentTime - when)), 0, 0]});
            updateMs.push(performance.now() - beforeMove);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        await new Promise((resolve) => setTimeout(resolve, (time + 0.2) * 1000));
        cancelAnimationFrame(raf);
        player.stop();
        meter.disconnect();
        meter.port.close();
        frames.sort((a, b) => a - b);
        result.push({
          mode,
          count,
          ...(updateMs.length ? { cameraUpdates: updateMs.length,
            cameraUpdateP95ms: updateMs.sort((a,b) => a-b)[Math.floor(updateMs.length*.95)] } : {}),
          warmupMs,
          setupMs,
          latencyAfterScheduledMs: stats?.first == null ? null : 1000 * (stats.first / r - when),
          firstFromPlayMs: stats?.first == null ? null : 1000 * (stats.first / r - when) + 35,
          gapFrames: stats?.gapFrames,
          peak: stats?.peak,
          frameP95ms: frames[Math.floor(frames.length * 0.95)],
          heapMB: performance.memory?.usedJSHeapSize / 1048576,
        });
      }
    const pack = [];
    if (prepared)
      for (let i = 0; i < 2; i++) {
        const offline = new OfflineAudioContext(2, packFrames, 44100),
          a = performance.now();
        const player = await ListeningPlayer.preload(offline, new URL('/pack/scene.json', location.href));
        const preloadMs = performance.now() - a;
        player.play(0);
        const renderStart = performance.now(),
          buffer = await offline.startRendering();
        const energy = (ch, lo, hi) => {
          let s = 0;
          for (let i = Math.round(lo * 44100); i < hi * 44100; i++) s += buffer.getChannelData(ch)[i] ** 2;
          return s;
        };
        pack.push({
          preloadMs,
          renderMs: performance.now() - renderStart,
          frames: buffer.length,
          windows: checkedWindows.map(({from,to,side}) => {
            const left = energy(0,from,to), right = energy(1,from,to);
            const power = (left + right) / (2 * (to-from) * 44100);
            return {from, to, side, left, right, pass: side === 'quiet' ? power < 1e-9 :
              power > 1e-10 && (side === 'audible' || (side === 'left' ? left > right : right > left))};
          }),
        });
      }
    const sim = new OfflineAudioContext(2, 44100, 44100),
      tone = sim.createBuffer(1, 44100, 44100);
    tone
      .getChannelData(0)
      .set(Float32Array.from({ length: 44100 }, (_, i) => 0.12 * Math.sin((2 * Math.PI * 770 * i) / 44100)));
    const source = {
      label: 'bell',
      offsetSec: 0,
      dry: { file: 'fixture.wav', restoreGain: 1 },
      placement: { position: [-2, 0, -1] },
    };
    const control = new ListeningPlayer(
      sim,
      {
        schemaVersion: 2,
        output: 'stereo',
        rate: 44100,
        frames: 44100,
        listener: { position: [0, 0, 0] },
        sources: [source],
        regions: [{ from: 0, to: 1, gain: { bell: 1 } }],
      },
      new Map([['bell', tone]]),
    );
    control.play(0);
    const turn = sim.suspend(0.25),
      move = sim.suspend(0.65),
      rendering = sim.startRendering();
    await turn;
    control.setListener({ position: [0, 0, 0], yaw: 180 });
    await sim.resume();
    await move;
    control.setPlacement('bell', { position: [2, 0, -1] });
    await sim.resume();
    const controlled = await rendering;
    const sideDb = (lo) => {
      const energy = (ch) =>
        controlled
          .getChannelData(ch)
          .subarray(Math.round(lo * 44100), Math.round((lo + 0.1) * 44100))
          .reduce((sum, x) => sum + x * x, 0);
      return 10 * Math.log10(energy(1) / energy(0));
    };
    const turns = [0.08, 0.45, 0.85].map(sideDb);
    const cutContext = new OfflineAudioContext(2, 44100, 44100);
    const cutTime = 0.4276;
    const cutPlayer = new ListeningPlayer(cutContext, {
      schemaVersion: 2, frames: 44100, rate: 44100, output: 'stereo', regions: [],
      listener: { position: [0,0,0], path:[{at:cutTime,position:[-6,0,0],cut:true}] },
      sources: [{...source, placement:{...source.placement,doppler:true}}],
    }, new Map([['bell', tone]]));
    cutPlayer.play(0);
    const film = await cutContext.startRendering();
    function readCut(at) {
      const power = [0,1].map(ch => film.getChannelData(ch).subarray(Math.round(at*44100),Math.round((at+.04)*44100)).reduce((sum,x)=>sum+x*x,0));
      return 10*Math.log10(power[1]/power[0]);
    }
    const cutPanDb = [readCut(.15),readCut(cutTime-.05),readCut(cutTime+.04)];
    // Inspect delivered tone energy after a game moves the listening camera during playback.
    async function changedCamera(balance, locked, moveSources = false) {
      const rate = 44100;
      const context = new OfflineAudioContext(2, 2 * rate, rate);
      const tones = new Map();
      for (const [label, hz] of [['motor', 500], ['weather', 1800]]) {
        const buffer = context.createBuffer(1, 2 * rate, rate);
        const channel = buffer.getChannelData(0);
        const length = label === 'motor' ? Math.round(1.35 * rate) : channel.length;
        for (let i = 0; i < length; i++) channel[i] = 0.12 * Math.sin(2 * Math.PI * hz * i / rate);
        tones.set(label, buffer);
      }
      const point = z => ({ kind: 'point', position: [0, 0, z], air: 0 });
      const source = (label, z) => ({
        label, offsetSec: 0, dry: { file: 'tone.wav', restoreGain: 1 },
        locked: label === 'weather' && locked, placement: point(z),
      });
      const player = new ListeningPlayer(context, {
        schemaVersion: 2, output: 'stereo', balance, rate, frames: 2 * rate,
        listener: { position: [0, 0, 0] }, sources: [source('motor', -1), source('weather', -5)],
        regions: [{ from: 0, to: 2, gain: { motor: 1, weather: 1 }, subjects: ['motor'], marginDb: 6 }],
      }, tones);
      player.play(0);
      const moved = context.suspend(0.35);
      const done = context.startRendering();
      await moved;
      if (moveSources) {
        player.setPlacement('motor', point(-3));
        player.setPlacement('weather', point(-1));
      } else {
        player.setListener({ position: [0, 0, -4] });
      }
      await context.resume();
      const audio = (await done).getChannelData(0);
      function toneDb(sec, hz) {
        let real = 0, imaginary = 0;
        const count = rate / 10;
        const start = Math.round(sec * rate);
        for (let i = 0; i < count; i++) {
          const angle = 2 * Math.PI * hz * i / rate;
          real += audio[start + i] * Math.cos(angle);
          imaginary += audio[start + i] * Math.sin(angle);
        }
        return 20 * Math.log10(Math.max(1e-10, 2 * Math.hypot(real, imaginary) / count));
      }
      const motor = toneDb(1, 500);
      const bed = toneDb(1, 1800);
      return { first: toneDb(0.15, 500) - toneDb(0.15, 1800), shifted: motor - bed,
        motor, bed, after: toneDb(1.84, 1800) };
    }
    const focusMove = {
      natural: await changedCamera('natural', false),
      directed: await changedCamera('directed', false),
      locked: await changedCamera('directed', true),
      emitters: await changedCamera('directed', false, true),
    };
    await ctx.close();
    return { unlockMs, rate: ctx.sampleRate, result, pack, turns, cutPanDb, focusMove };
  }, {prepared:Boolean(prepared),checkedWindows,packFrames});
  const pass =
    !errors.length && Math.abs(results.cutPanDb[0] - results.cutPanDb[1]) < 0.5 && results.cutPanDb[1] < -6 && results.cutPanDb[2] > 6 &&
    results.focusMove.emitters.shifted > 5 && results.result.some(t => t.cameraUpdates >= 10) &&
    results.focusMove.natural.shifted < -6 && results.focusMove.directed.shifted > 5 &&
    Math.abs(results.focusMove.natural.first - results.focusMove.directed.first) < .1 &&
    Math.abs(results.focusMove.natural.motor - results.focusMove.directed.motor) < .1 &&
    Math.abs(results.focusMove.locked.bed - results.focusMove.natural.bed) < .1 &&
    Math.abs(results.focusMove.directed.after - results.focusMove.natural.after) < 1 &&
    results.result.every((t) => t.peak > 0 && t.gapFrames === 0) &&
    results.turns[0] < -6 &&
    results.turns[1] > 6 &&
    results.turns[2] < -6 &&
    results.pack.every(t => t.windows.every(w => w.pass));
  console.log(JSON.stringify({ pass, errors, ...results }, null, 2));
  process.exitCode = Number(!pass);
} finally {
  await browser?.close();
  server.close();
}
