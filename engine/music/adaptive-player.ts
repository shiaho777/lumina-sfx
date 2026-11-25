import {
  AdaptiveMusicDirector, type AdaptiveMusicBank, type MusicStart, type MusicTransition, readAdaptiveBank, transitionEnvelope,
} from './adaptive.ts';

interface ScheduledVoice {
  node: AudioBufferSourceNode;
  gain: GainNode;
  start: number;
  inEnd: number;
  initialGain: number;
  outStart?: number;
  outEnd?: number;
  outGain?: number;
}

function valueAt(voice: ScheduledVoice, time: number) {
  if (time < voice.start) return 0;
  if (voice.outStart !== undefined && time >= voice.outStart) {
    return voice.outGain! * Math.max(0, (voice.outEnd! - time) / Math.max(1e-8, voice.outEnd! - voice.outStart));
  }
  if (time >= voice.inEnd) return 1;
  return voice.initialGain + (1 - voice.initialGain) * (time - voice.start) / (voice.inEnd - voice.start);
}

export class AdaptiveMusicPlayer {
  private readonly context: BaseAudioContext;
  private readonly buffers: ReadonlyMap<string, AudioBuffer>;
  readonly bank: AdaptiveMusicBank;
  readonly output: GainNode;
  private readonly active = new Set<ScheduledVoice>();
  private director?: AdaptiveMusicDirector;
  private origin = 0;
  private last?: MusicStart;
  private current?: ScheduledVoice;
  private timer?: ReturnType<typeof setInterval>;
  private disposed = false;

  constructor(context: BaseAudioContext, manifest: unknown, buffers: ReadonlyMap<string, AudioBuffer>, destination = context.destination as AudioNode) {
    this.context = context;
    this.bank = readAdaptiveBank(manifest);
    this.buffers = new Map(buffers);
    for (const [id, clip] of Object.entries(this.bank.clips)) {
      const buffer = this.buffers.get(id);
      if (!buffer || Math.abs(buffer.duration - clip.frames / this.bank.sampleRate) > 0.002) {
        throw Error('Missing or mismatched audio buffer: ' + id);
      }
    }
    this.output = context.createGain();
    this.output.connect(destination);
  }

  static async load(context: BaseAudioContext, manifestUrl: string | URL, destination = context.destination as AudioNode) {
    const location = new URL(manifestUrl, globalThis.location?.href);
    const response = await fetch(location);
    if (!response.ok) throw Error('Could not load music bank: ' + response.status);
    const bank = readAdaptiveBank(await response.json());
    const entries = await Promise.all(Object.entries(bank.clips).map(async ([id, clip]) => {
      const response = await fetch(new URL(clip.file, location));
      if (!response.ok) throw Error('Could not load music clip: ' + id);
      return [id, await context.decodeAudioData(await response.arrayBuffer())] as const;
    }));
    return new AdaptiveMusicPlayer(context, bank, new Map(entries), destination);
  }

  start(): void {
    if (this.disposed) throw Error('Music player has been disposed');
    if (this.director) return;
    this.director = new AdaptiveMusicDirector(this.bank);
    this.origin = this.context.currentTime + 0.05;
    this.update();
    this.timer = setInterval(() => this.update(), 25);
  }

  setState(state: string, options: Partial<MusicTransition> & { beat?: number } = {}): number | null {
    const director = this.requireDirector();
    const beat = director.request(state, this.earliest(options.beat), options);
    this.update();
    return beat;
  }

  setIntensity(value: number, options: Partial<MusicTransition> & { beat?: number } = {}): number | null {
    const director = this.requireDirector();
    const beat = director.setIntensity(value, this.earliest(options.beat), options);
    this.update();
    return beat;
  }

  update(): void {
    const director = this.director;
    if (!director) return;
    const now = this.context.currentTime;
    const seconds = 60 / this.bank.bpm;
    const through = Math.max(director.scheduledThrough, (now + 0.12 - this.origin) / seconds);
    for (const action of director.advance(through)) this.schedule(action, now, seconds);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.director = undefined;
    this.current = undefined;
    this.last = undefined;
    const now = this.context.currentTime;
    for (const voice of this.active) {
      if (now < voice.start) voice.node.stop(now);
      else this.fade(voice, now, now + 0.016);
    }
  }

  dispose(): void {
    this.stop();
    this.output.disconnect();
    this.disposed = true;
  }

  private requireDirector(): AdaptiveMusicDirector {
    if (!this.director) throw Error('Start the music before scheduling changes');
    return this.director;
  }

  private earliest(beat: number | undefined): number {
    if (beat !== undefined && (!Number.isFinite(beat) || beat < 0)) throw Error('Scheduled beat must be nonnegative');
    return Math.max(beat ?? 0, 0, (this.context.currentTime + 0.018 - this.origin) * this.bank.bpm / 60);
  }

  private fade(voice: ScheduledVoice, from: number, to: number): void {
    const gain = valueAt(voice, from);
    const param = voice.gain.gain;
    const duringRamp = (from > voice.start && from < voice.inEnd) ||
      (voice.outStart !== undefined && from > voice.outStart && from < voice.outEnd!);
    if (typeof param.cancelAndHoldAtTime === 'function') {
      param.cancelAndHoldAtTime(from);
      param.setValueAtTime(gain, from);
    } else {
      param.cancelScheduledValues(from);
      if (duringRamp) param.linearRampToValueAtTime(gain, from);
      else param.setValueAtTime(gain, from);
    }
    voice.outStart = from;
    voice.outEnd = to;
    voice.outGain = gain;
    if (to > from) param.linearRampToValueAtTime(0, to);
    voice.node.stop(to);
  }

  private schedule(cue: MusicStart, now: number, seconds: number): void {
    const planned = this.origin + cue.beat * seconds;
    const start = Math.max(now, planned);
    const envelope = transitionEnvelope(this.bank, this.last, cue);
    const attack = envelope.after * seconds;
    const fadeEnd = planned + attack;
    if (this.current && this.active.has(this.current)) {
      const fadeStart = Math.max(now, planned - envelope.before * seconds);
      this.fade(this.current, fadeStart, Math.max(fadeStart, planned + envelope.overlap * seconds));
    }
    this.current = undefined;
    this.last = cue;
    const buffer = this.buffers.get(cue.section)!;
    const offset = cue.offsetBeat * seconds + start - planned;
    if (offset >= buffer.duration) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer;
    source.connect(gain).connect(this.output);
    const initialGain = attack ? Math.min(1, (start - planned) / attack) : 1;
    const voice: ScheduledVoice = { node: source, gain, start, initialGain, inEnd: Math.max(start, fadeEnd) };
    gain.gain.setValueAtTime(initialGain, start);
    if (voice.inEnd > start) gain.gain.linearRampToValueAtTime(1, voice.inEnd);
    this.active.add(voice);
    this.current = voice;
    source.onended = () => {
      this.active.delete(voice);
      source.disconnect();
      gain.disconnect();
    };
    source.start(start, offset);
  }
}
