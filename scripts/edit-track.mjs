import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { contactProbes } from './edit-contacts.mjs';
import { biquad } from '../engine/dsp.ts';
import { ffmpegPath } from './audio-export.mjs';

// Measure both channels before summing energy so hard-panned or antiphase sources are retained.
export async function measureTrack(file, stream = 0, events = [], fps = 30, projectDevice) {
  if (!Number.isSafeInteger(stream) || stream < 0) throw Error('Invalid original audio stream');
  const proc = spawn(
    ffmpegPath(),
    [
      '-nostdin',
      '-hide_banner',
      '-v',
      'error',
      '-copyts',
      '-start_at_zero',
      '-i',
      resolve(file),
      '-map',
      '0:a:' + stream,
      '-vn',
      '-af',
      'aresample=12000:async=1:first_pts=0',
      '-ac',
      '2',
      '-ar',
      '12000',
      '-f',
      's16le',
      'pipe:1',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // Register a rejection handler immediately, including when the binary is missing.
  const done = once(proc, 'close').then(
    ([status]) => ({ status }),
    (error) => ({ error }),
  );
  let error = '',
    spare = Buffer.alloc(0),
    sum = 0,
    peak = 0,
    presence = 0,
    count = 0;
  proc.stderr.on('data', (b) => {
    error = (error + b).slice(-1500);
  });
  const windows = [],
    probes = events.length ? contactProbes(events, fps, projectDevice) : null;
  const bands = [0, 1].map(() => {
    const high = biquad('highpass', 1800, Math.SQRT1_2, 12000);
    const low = biquad('lowpass', 4700, Math.SQRT1_2, 12000);
    return (x) => low(high(x));
  });
  let at = 0;
  const flush = () => {
    windows.push({ energy: sum / count, presenceEnergy: presence / count, peak });
    presence = 0;
    sum = 0;
    peak = 0;
    count = 0;
  };
  for await (const chunk of proc.stdout) {
    const buf = spare.length ? Buffer.concat([spare, chunk]) : chunk;
    const end = buf.length - (buf.length % 4);
    if (probes) {
      const mid = new Float32Array(end / 4);
      let side;
      for (let i = 0; i < end; i += 4) {
        const left = buf.readInt16LE(i), right = buf.readInt16LE(i + 2);
        mid[i / 4] = (left + right) / 65536;
        if (left !== right) {
          side ??= new Float32Array(mid.length);
          side[i / 4] = (left - right) / 65536;
        }
      }
      probes.write(mid, at, side);
      at += mid.length;
    }
    for (let i = 0; i < end; i += 2) {
      const x = buf.readInt16LE(i) / 32768;
      const band = bands[(i >> 1) & 1](x);
      presence += band * band;
      sum += x * x;
      peak = Math.max(peak, Math.abs(x));
      count++;
      if (count === 1200) flush();
    }
    spare = buf.subarray(end);
  }
  const closed = await done;
  if (closed.error) throw closed.error;
  if (closed.status) {
    if (stream === 0 && /matches no streams|does not contain any stream/.test(error))
      return { windowSec: 0.05, windows: [] };
    throw Error(error || 'Original audio decode failed');
  }
  if (count) flush();
  return { windowSec: 0.05, windows, contacts: probes?.finish() };
}
