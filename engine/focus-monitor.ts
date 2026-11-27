import { biquad } from './dsp.ts';
import type { Region, Stem } from './listening-scene.ts';

const modes = ['stereo', 'mono', 'phone'] as const;
type Mode = (typeof modes)[number];
type Gram = Float64Array[];
interface Window {
  at: number;
  matrix: Gram;
}
interface Reading {
  at: number;
  marginDb: number;
  masker: string | null;
}

// Covariance of positioned signals preserves cancellation when monitoring the mono fold.
// Two adjacent 50 ms blocks give a 100 ms window, advancing every 50 ms.
function listenWindows(
  stems: Stem[],
  r: Region,
  rate: number,
  fade?: (label: string, time: number) => number,
): Window[] {
  const count = stems.length,
    hop = Math.max(1, Math.round(rate * 0.05));
  const end = Math.round(r.to * rate),
    start = Math.round(r.from * rate);
  const size = count * count;
  const hp = stems.map(() => biquad('highpass', 300, 0.707, rate));
  const lp = stems.map(() => biquad('lowpass', Math.min(3400, rate * 0.45), 0.707, rate));
  const windows: Window[] = [];
  let prev: Gram | undefined;
  for (let from = start; from < end; from += hop) {
    const n = Math.min(hop, end - from);
    const buffers = stems.map((s, k) => {
      let left = s.ears[0],
        right = s.ears[1] ?? left;
      let lo = from - s.offset;
      if (fade) {
        const l = new Float32Array(n),
          rr = new Float32Array(n);
        for (let j = Math.max(0, -lo); j < Math.min(n, left.length - lo); j++) {
          const g = fade(s.label, (from + j) / rate);
          l[j] = left[lo + j] * g;
          rr[j] = right[lo + j] * g;
        }
        left = l;
        right = rr;
        lo = 0;
      }
      const phone = new Float32Array(n);
      for (let j = 0; j < n; j++) {
        const pos = lo + j;
        const mid = pos >= 0 && pos < left.length ? (left[pos] + right[pos]) * 0.5 : 0;
        phone[j] = lp[k](hp[k](mid));
      }
      return { left, right, phone, lo };
    });
    const gram = modes.map(() => new Float64Array(size));
    for (let i = 0; i < count; i++)
      for (let k = i; k < count; k++) {
        const a = buffers[i],
          b = buffers[k];
        let stereo = 0,
          mono = 0,
          phone = 0;
        const begin = Math.max(0, -a.lo, -b.lo),
          stop = Math.min(n, a.left.length - a.lo, b.left.length - b.lo);
        for (let j = begin; j < stop; j++) {
          const al = a.left[a.lo + j],
            ar = a.right[a.lo + j],
            bl = b.left[b.lo + j],
            br = b.right[b.lo + j];
          stereo += (al * bl + ar * br) * 0.5;
          mono += (al + ar) * (bl + br) * 0.25;
        }
        for (let j = 0; j < n; j++) phone += a.phone[j] * b.phone[j];
        for (const [m, value] of [stereo, mono, phone].entries())
          gram[m][i * count + k] = gram[m][k * count + i] = value;
      }
    if (prev || end - start <= hop) {
      const matrix = gram.map((g, m) => g.map((v, j) => (v + (prev?.[m][j] ?? 0)) / (n + (prev ? hop : 0))));
      windows.push({ at: (from - (prev ? hop : 0)) / rate, matrix });
    }
    prev = gram;
  }
  return windows;
}
const powerDb = (v: number) => 10 * Math.log10(Math.max(1e-15, v));
function assess(windows: Window[], stems: Stem[], r: Region, delivered = false) {
  const n = stems.length,
    focus = stems.map((s) => r.subjects.includes(s.label)),
    g = stems.map((s) => (delivered ? 1 : r.gain[s.label]));
  const trace = modes.map((_, m) =>
    windows.map((w) => {
      const gram = w.matrix[m];
      let f = 0,
        b = 0,
        locked = 0,
        masker = -1,
        dominant = 0,
        adjustable = -1,
        bestReduction = 0;
      for (let i = 0; i < n; i++) {
        let contribution = 0;
        for (let j = 0; j < n; j++)
          if (focus[i] === focus[j]) {
            const value = gram[i * n + j] * g[i] * g[j];
            contribution += value;
            if (!focus[i] && stems[i].locked && stems[j].locked) locked += value;
          }
        if (focus[i]) f += contribution;
        else {
          b += contribution;
          if (contribution > dominant) {
            dominant = contribution;
            masker = i;
          }
          if (!stems[i].locked && g[i] > 10 ** (-30 / 20) + 1e-9) {
            const cut = 1 - Math.max(10 ** (-30 / 20) / g[i], 10 ** (-1 / 20));
            const reduction = 2 * cut * contribution - cut * cut * gram[i * n + i] * g[i] * g[i];
            if (reduction > bestReduction) {
              bestReduction = reduction;
              adjustable = i;
            }
          }
        }
      }
      return { at: w.at, f, b, locked, masker, adjustable, marginDb: powerDb(f) - powerDb(b) };
    }),
  );
  return trace.map((xs) => {
    const peak = xs.reduce((max, w) => Math.max(max, w.f), 0);
    return xs.filter((w) => w.f > Math.max(1e-12, peak * 0.008) && w.b > 1e-12);
  });
}
export interface PlaybackReadout {
  windows: number;
  p10Db: number | null;
  worst: Reading | null;
  peakDb: number | null;
}
export interface FocusMonitor {
  views: Record<Mode, PlaybackReadout>;
  adjusted: string[];
  planned?: Record<Mode, PlaybackReadout>;
}
export function monitorFocus(
  stems: Stem[],
  r: Region,
  rate: number,
  adjust: boolean,
  fade?: (label: string, time: number) => number,
): FocusMonitor | undefined {
  if (!r.subjects.length || !stems.some((s) => !r.subjects.includes(s.label))) return;
  const windows = listenWindows(stems, r, rate, fade);
  if (adjust) for (const s of stems) if (!r.subjects.includes(s.label) && !s.locked) r.gain[s.label] = 1;
  let traces = assess(windows, stems, r, Boolean(fade));
  const adjusted = new Set<string>();
  const margin = r.marginDb;
  // Steady trims within each authored region avoid pumping on individual transients.
  if (adjust && margin !== null) {
    for (let step = 0; step < stems.length * 32; step++) {
      const burden = new Float64Array(stems.length);
      for (const trace of traces) {
        const misses = trace.filter((w) => w.marginDb < margin);
        const allowed = Math.floor(trace.length * 0.05);
        if (misses.length <= allowed) continue;
        const avoidable = misses.filter((w) => w.adjustable >= 0 && w.locked < w.f * 10 ** (-margin / 10));
        if (misses.length - avoidable.length > allowed) continue;
        for (const w of avoidable) burden[w.adjustable] += Math.min(30, margin - w.marginDb) / trace.length;
      }
      const most = Math.max(...burden);
      if (!most) break;
      const label = stems[burden.indexOf(most)].label;
      r.gain[label] = Math.max(10 ** (-30 / 20), r.gain[label] * 10 ** (-1 / 20));
      adjusted.add(label);
      traces = assess(windows, stems, r);
    }
  }
  const views = {} as Record<Mode, PlaybackReadout>;
  for (const [i, mode] of modes.entries()) {
    const sorted = [...traces[i]].sort((a, b) => a.marginDb - b.marginDb),
      worst = sorted[0];
    views[mode] = {
      windows: sorted.length,
      p10Db: sorted[Math.floor(sorted.length * 0.1)]?.marginDb ?? null,
      peakDb: sorted.at(-1)?.marginDb ?? null,
      worst: worst
        ? {
            at: worst.at,
            marginDb: worst.marginDb,
            masker: worst.masker >= 0 ? stems[worst.masker].label : null,
          }
        : null,
    };
  }
  return { views, adjusted: [...adjusted] };
}
