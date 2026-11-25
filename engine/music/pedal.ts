import { biquad } from './dsp.ts';
import type { AutomationPoint } from './score.ts';
import { midiHz } from './theory.ts';

function lastEvent(points: readonly AutomationPoint[], beat: number): number {
  let low = 0, high = points.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid][0] <= beat) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

export function pedalRelease(points: readonly AutomationPoint[], span: number, loop: boolean, beat: number): number {
  const offset = loop ? Math.floor(beat / span) * span : 0;
  const position = beat - offset;
  const index = lastEvent(points, position);
  const state = points[index]?.[1] ?? (loop ? points.at(-1)![1] : 0);
  if (!state) return beat;
  for (let next = index + 1; next < points.length; next++) {
    if (points[next][1] === 0) return points[next][0] + offset;
  }
  if (!loop) return Math.max(beat, span);
  return offset + span + points.find(([, value]) => value === 0)![0];
}

export function addPianoResonance(
  [left, right]: readonly [Float32Array, Float32Array], points: readonly AutomationPoint[], midiNotes: readonly number[],
  { rate, framesPerBeat, beats, loop }: { rate: number; framesPerBeat: number; beats: number; loop: boolean },
): void {
  if (!points.some(([, value]) => value === 1) || !midiNotes.length) return;
  const counts = new Map<number, number>();
  for (const midi of midiNotes) counts.set(midi % 12, (counts.get(midi % 12) ?? 0) + 1);
  const resonances = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 8).map(([pitch]) => {
    const hz = midiHz(60 + pitch);
    return { ring: biquad('bandpass', hz, 47, rate), side: (pitch % 5 - 2) * 0.09 };
  });
  const frames = left.length;
  const warm = loop ? Math.round(rate * 0.4) : 0;
  const output = 0.085 / Math.sqrt(resonances.length);
  const openRate = 1 - Math.exp(-1 / (0.014 * rate)), closeRate = 1 - Math.exp(-1 / (0.024 * rate));
  const endFade = loop ? 0 : Math.round(rate * 0.025);
  let previousFrame = Infinity, index = -1, openness = 0;
  for (let i = -warm; i < frames; i++) {
    const frame = i < 0 ? (i % frames + frames) % frames : i;
    const beat = frame / framesPerBeat;
    if (frame < previousFrame) index = lastEvent(points, beat);
    while (index + 1 < points.length && points[index + 1][0] <= beat) index++;
    previousFrame = frame;
    const state = !loop && beat >= beats ? 0 : points[index]?.[1] ?? (loop ? points.at(-1)![1] : 0);
    openness += (state - openness) * (state ? openRate : closeRate);
    const excitation = (left[frame] + right[frame]) * 0.5 * openness;
    let sum = 0, side = 0;
    for (const resonance of resonances) {
      const sample = resonance.ring(excitation);
      sum += sample;
      side += sample * resonance.side;
    }
    if (i >= 0) {
      const fade = endFade ? Math.min(1, (frames - 1 - frame) / endFade) : 1;
      const gain = output * openness * fade;
      left[frame] += (sum + side) * gain;
      right[frame] += (sum - side) * gain;
    }
  }
}

export function cropPedal(points: AutomationPoint[] | undefined, start: number, end: number, loop: boolean): AutomationPoint[] | undefined {
  if (!points) return undefined;
  const index = lastEvent(points, start);
  const state = points[index]?.[1] ?? (loop ? points.at(-1)![1] : 0);
  return [[0, state], ...points.filter(([beat]) => beat > start && beat < end)
    .map(([beat, value]) => [beat - start, value] as const), [end - start, 0]];
}
