import type { MusicRoom } from './score.ts';

const rooms = {
  studio: { delays: [0.0131, 0.0173, 0.0239, 0.0297], decay: 0.58, damping: 0.30 },
  hall: { delays: [0.0297, 0.0371, 0.0437, 0.0531], decay: 1.42, damping: 0.34 },
};

export function roomTailFrames(name: MusicRoom, rate: number): number {
  return Math.ceil(rooms[name].decay * 1.12 * rate);
}

export function applyRoom(left: Float32Array, right: Float32Array, rate: number, name: MusicRoom, send: number, loop: boolean): void {
  const preset = rooms[name];
  const frames = left.length;
  const lines = preset.delays.map(seconds => ({
    signal: new Float64Array(Math.max(1, Math.round(seconds * rate))),
    feedback: 10 ** (-3 * seconds / preset.decay),
    damping: 0,
    index: 0,
  }));
  const [a, b, c, d] = lines;
  const warm = loop ? roomTailFrames(name, rate) : 0;
  const fadeFrames = loop ? 0 : Math.round(rate * 0.035);
  const tap = (line: typeof a) => {
    line.damping += preset.damping * (line.signal[line.index] - line.damping);
    return line.damping;
  };
  const store = (line: typeof a, dry: number, feedback: number) => {
    line.signal[line.index] = dry * 0.27 + feedback * line.feedback * 0.5;
    if (++line.index === line.signal.length) line.index = 0;
  };
  for (let i = -warm; i < frames; i++) {
    const frame = i < 0 ? (i % frames + frames) % frames : i;
    const x = left[frame], y = right[frame];
    const u = tap(a), v = tap(b), w = tap(c), z = tap(d);
    store(a, x, u + v + w + z);
    store(b, y, u - v + w - z);
    store(c, x, u + v - w - z);
    store(d, -y, u - v - w + z);
    if (i >= 0) {
      const fade = fadeFrames ? Math.min(1, (frames - 1 - i) / fadeFrames) : 1;
      const level = send * fade * 0.76;
      left[i] = x + level * (u + v - w + z);
      right[i] = y + level * (u - v + w + z);
    }
  }
}
