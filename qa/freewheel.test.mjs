import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSound } from '../engine/render.ts';
import freewheel from '../recipes/bicycle-coasting-freewheel.ts';

const rate = 48000;

// Find the strongest short high-frequency burst in each tooth contact. This
// counts the rendered PCM, including the join between two native loop plays.
function contactTimes(audio) {
  const block = 24;
  const energy = [];
  let maximum = 0;
  for (let i = 1; i + block <= audio.length; i += block) {
    let sum = 0;
    for (let j = i; j < i + block; j++) sum += (audio[j] - audio[j - 1]) ** 2;
    energy.push(sum);
    maximum = Math.max(maximum, sum);
  }
  const peaks = [];
  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] < maximum * 0.06 || energy[i] < energy[i - 1] || energy[i] <= energy[i + 1]) continue;
    const last = peaks.at(-1);
    if (last !== undefined && (i - last) * block < rate * 0.015) {
      if (energy[i] > energy[last]) peaks[peaks.length - 1] = i;
    } else {
      peaks.push(i);
    }
  }
  return peaks.map(i => i * block / rate);
}

test('coasting freewheel holds its tooth rate across a loop join and changes pace with wheel speed', () => {
  for (const seed of [104729, 112920, 121111]) {
    for (const [speed, expectedHz] of [[0, 12], [0.45, 25.5], [1, 42]]) {
      const loop = renderSound(freewheel, { seed, params: { speed } }, rate);
      const audio = new Float32Array(loop.length * 2);
      audio.set(loop);
      audio.set(loop, loop.length);
      const times = contactTimes(audio);
      const rateHz = (times.length - 1) / (times.at(-1) - times[0]);
      assert.ok(Math.abs(rateHz - expectedHz) < 0.2, `speed ${speed}: ${rateHz} ticks/s`);
      for (let i = 1; i < times.length; i++) {
        const interval = times[i] - times[i - 1];
        // The recorded impact can reach its strongest peak a few ms after onset.
        assert.ok(Math.abs(interval - 1 / expectedHz) < 0.0045,
          `speed ${speed}, seed ${seed}: ${interval} s between tooth peaks`);
      }
    }
  }
});
