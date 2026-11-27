#!/usr/bin/env node
import {relatedTakes} from './related-takes.mjs';
import { resolveSourceReview } from './source-review.mjs';
import { editorialAction } from './editorial-intent.mjs';
import { createHash } from 'node:crypto';
import { renderChannels, DEFAULT_SEED } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { loadRecipes } from './recipes.mjs';
import { checkIsolatedRecipes } from './install-files.mjs';
import { sceneMoods } from '../engine/scene-mood.ts';
import { sceneStyles } from '../engine/remix.ts';
import { macroControls, renderDurationSec } from '../engine/sculpt.ts';

const recipes = await loadRecipes();
if (!recipes.length) throw new Error('No recipes found');
const { tickets } = JSON.parse(await readFile(new URL('../tasks/queue.json', import.meta.url), 'utf8'));
const byId = new Map(tickets.map(ticket => [ticket.id, ticket]));
const review = JSON.parse(await readFile(new URL('../qa/background-review.json', import.meta.url), 'utf8'));
const holds=JSON.parse(await readFile(new URL('../qa/source-holds.json',import.meta.url),'utf8')).holds;
const auditions=JSON.parse(await readFile(new URL('../qa/flag-auditions.json',import.meta.url)));
const reviewed = new Map([...review.sounds, ...review.relatedRepairs].map(entry => [entry.id, entry]));
// A new seed response or a changed recording invalidates the badge even if the default master matches.
function matchesReviewedAudio(recipe, fingerprint) {
  if (!fingerprint) return undefined;
  const hash = createHash('sha256');
  for (const setting of ['default', 'min', 'max']) {
    const params = Object.fromEntries(Object.entries(recipe.params).map(([key, spec]) => [key, spec[setting]]));
    for (let index = 0; index < 4; index++) {
      const seed = DEFAULT_SEED + index * 8191;
      hash.update(Buffer.from(encodeWav(renderChannels(recipe, { seed, params }))));
    }
  }
  return hash.digest('hex') === fingerprint || undefined;
}
const sounds = recipes.map(recipe => {
  const { id, name, category, tags, loopable, macros, params, targetRmsDbfs, mixRole, recording, additionalRecordings, spectrum, renderStereo } = recipe;
  const ticket = byId.get(id);
  const entry = reviewed.get(id);
  const current = matchesReviewedAudio(recipe, entry?.variantsSha256);
  const disposition=resolveSourceReview(recipe,holds[id],auditions.auditions[id],auditions.seeds);
  return {
    id, name, category, revision: ticket?.revision, editorialAction: editorialAction(id, ticket?.collection),
    ...disposition, relatedTakes:relatedTakes.find(group=>group.includes(id))?.filter(other=>other!==id), isolation: recipe.isolation, backgroundChecked: current && !recipe.auditionNote && !entry.auditionNote && !disposition.cleanHold || undefined,
    auditionNote: recipe.auditionNote ?? (current ? entry.auditionNote : undefined), markers: recipe.markers, soloQueries:recipe.soloQueries, closeMatches:recipe.closeMatches, components:recipe.components, contains: recipe.contains, perspective: recipe.perspective, collection: ticket?.collection, tags, loopable, sustainMode:recipe.sustainMode, durationSec: renderDurationSec(recipe), macros, params, targetRmsDbfs, mixRole, recording,
    additionalRecordings, takeCount: recipe.takeCount, spectrum, channels: renderStereo ? 2 : 1, gestureTiming: recipe.withGestureTiming ? 'native' : undefined, file: `recipes/${id}.ts`,
  };
});
await checkIsolatedRecipes(sounds.filter(sound => sound.isolation === 'isolated'));
await writeFile(new URL('../catalog.json', import.meta.url),
  JSON.stringify({ schemaVersion: 1, macroControls, sceneStyles, sceneMoods, count: sounds.length, sounds }, null, 2) + '\n');
process.stdout.write(`Indexed ${sounds.length} recipes\n`);
