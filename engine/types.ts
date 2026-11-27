export type Category =
  | 'Weapons' | 'Combat Foley' | 'Weather & Ambience' | 'Footsteps & UI'
  | 'Animals' | 'Vehicles & Engines' | 'Aircraft' | 'Missiles'
  | 'Water & Fire' | 'Impacts' | 'Sci-Fi & UI' | 'Farming' | 'Props & Interactions';

export type LevelProfile = 'original' | 'balanced';
export type MixRole = 'ambience' | 'detail' | 'foley' | 'interface' | 'voice' | 'vehicle' | 'impact';

export interface SoundParameter {
  label: string;
  min: number;
  max: number;
  default: number;
}

export interface SpectralExpectation {
  band: 'sub' | 'high';
  minShare: number;
}

export interface RenderContext {
  /** Start of the continuation supplied for a loop crossfade, in sample frames. */
  readonly loopFrames?: number;
  readonly sampleRate: number;
  readonly frames: number;
  random(): number;
}

export interface DesignMacros {
  punch?: number;
  size?: number;
  distance?: number;
  space?: 'dry' | 'small_room' | 'hallway' | 'outdoor' | 'cavern' | 'outdoor_open' | 'canyon_echo' | 'underwater';
  wetness?: number;
  grit?: number;
  speed?: number;
  pitchShift?: number;
}

export interface RenderOptions {
  macros?: Readonly<DesignMacros>;
  seed?: number;
  params?: Readonly<Record<string, number>>;
  level?: LevelProfile;
}

export interface ResolvedOptions {
  readonly seed: number;
  readonly params: Readonly<Record<string, number>>;
}

export interface RecordingCredit {
  readonly title: string;
  readonly author: string;
  readonly url: string;
  readonly license: 'CC0-1.0' | 'Public Domain';
  readonly verifiedOn: string;
}

export interface SoundRecipe {
  /** A scene owns its event clock and relative listening level. */
  preserveTimeline?: boolean;
  /** Audible issue that should exclude this take from automatic and clean selection. */
  readonly auditionNote?: string;
  readonly isolation?: 'isolated';
  readonly markers?: Readonly<Record<string, number>>;
  /** Optional audition substitutes. The named trait is unverified and must be disclosed. */
  readonly closeMatches?: readonly { phrases: readonly string[]; term: string; note: string }[];
  readonly soloQueries?: readonly string[];
  readonly components?:readonly string[];
  readonly contains?: readonly string[];
  readonly perspective?: string;
  readonly macros?: Readonly<DesignMacros>;
  readonly id: string;
  readonly name: string;
  readonly category: Category;
  readonly tags: readonly string[];
  readonly loopable: boolean;
  /** Can generate a continuous performance for arbitrary frame counts. */
  readonly sustainMode?: 'evolving';
  /** Re-perform a directional gesture with its accent at a picture landmark, in seconds. */
  withGestureTiming?(durationSec: number, apexSec: number, motion?: 'turn', screenPath?: readonly (readonly [time: number, progress: number])[]): SoundRecipe;
  readonly durationSec: number;
  readonly params: Readonly<Record<string, SoundParameter>>;
  readonly immediateOnset?: boolean;
  readonly targetRmsDbfs?: number;
  readonly mixRole?: MixRole;
  readonly recording?: RecordingCredit;
  readonly additionalRecordings?: readonly RecordingCredit[];
  readonly spectrum?: readonly SpectralExpectation[];
  renderStereo?(ctx: RenderContext, opts: ResolvedOptions): readonly [Float32Array, Float32Array];
  render(ctx: RenderContext, opts: ResolvedOptions): Float32Array;
}
