import type { StereoPcm } from '../master.ts';
import { renderChannels } from '../render.ts';
import { renderDurationSec } from '../sculpt.ts';
import type { SoundRecipe } from '../types.ts';
import { panGains } from './dsp.ts';
import { noteWindow } from './performance.ts';
import type { MusicTrack } from './score.ts';
import { noteMidi } from './theory.ts';

export function prepareRecipePart(
  track: MusicTrack, recipes: ReadonlyMap<string, SoundRecipe> | undefined, rate: number, framesPerBeat: number, scoreFrames: number,
) {
  const id = track.recipe;
  const recipe = id && recipes?.get(id);
  if (!recipe || recipe.id !== id) throw Error(track.id + ' needs the catalog recipe ' + id);
  for (const [name, value] of Object.entries(track.params ?? {})) {
    const parameter = Object.hasOwn(recipe.params, name) && recipe.params[name];
    if (!parameter || value < parameter.min || value > parameter.max) throw Error(recipe.id + ' has no parameter ' + name + ' at ' + value);
  }
  const natural = Math.round(renderDurationSec(recipe) * rate);
  const baseShift = recipe.macros?.pitchShift ?? 0;
  const root = track.root;
  const notes = track.notes.filter(note => note.velocity > 0).map(note => {
    const { start, written } = noteWindow(note, framesPerBeat, scoreFrames);
    const pitchShift = root === undefined ? baseShift : baseShift +
      (typeof note.note === 'number' ? note.note : noteMidi(note.note)) - root;
    if (pitchShift < -24 || pitchShift > 24) throw Error(track.id + ' at beat ' + note.beat + ' exceeds the recipe pitch range of ±24 semitones');
    const length = recipe.loopable ? written : Math.min(written, natural);
    return { ...note, start, hold: length, length, pitchShift };
  });
  return { recipe, notes };
}

export function renderRecipePart(
  stem: StereoPcm, track: MusicTrack, part: ReturnType<typeof prepareRecipePart>, rate: number, seed: number, trackGain: number,
): void {
  const { recipe, notes } = part;
  const [left, right] = panGains(track.pan);
  const cache = new Map<number, Float32Array[]>();
  const frames = stem[0].length;
  for (const note of notes) {
    let sound = cache.get(note.pitchShift);
    if (!sound) {
      const macros = note.pitchShift === (recipe.macros?.pitchShift ?? 0) ? undefined : { pitchShift: note.pitchShift };
      sound = renderChannels(recipe, { seed, params: track.params, macros }, rate);
      if (sound[0].length <= rate * 2) cache.set(note.pitchShift, sound);
    }
    const natural = sound[0].length;
    const fade = Math.max(1, Math.min(note.length >> 1, Math.round(rate * 0.01)));
    const level = note.velocity * trackGain;
    const leftGain = left * (sound.length === 2 ? Math.SQRT2 : 1);
    const rightGain = right * (sound.length === 2 ? Math.SQRT2 : 1);
    let position = note.start;
    for (let i = 0; i < note.length; i++) {
      const attack = recipe.loopable ? Math.min(1, i / fade) : 1;
      const release = recipe.loopable || note.length < natural ? Math.min(1, (note.length - 1 - i) / fade) : 1;
      const gain = level * Math.min(attack, release);
      const sourceFrame = i % natural;
      stem[0][position] += sound[0][sourceFrame] * leftGain * gain;
      stem[1][position] += (sound[1] ?? sound[0])[sourceFrame] * rightGain * gain;
      position = position + 1 === frames ? 0 : position + 1;
    }
  }
}
