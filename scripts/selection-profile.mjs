import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export async function selectionProfile(path) {
  if (!path) return {};
  const profile = JSON.parse(await readFile(path, 'utf8'));
  if (!profile || Array.isArray(profile) || typeof profile !== 'object')
    throw Error('Expected a selection profile');
  if (profile.palette !== undefined && !['soft', 'crisp'].includes(profile.palette))
    throw Error('Choose a soft or crisp palette');
  if (profile.useCase !== undefined && typeof profile.useCase !== 'string')
    throw Error('Expected a useCase string');
  const files = profile.votes === undefined ? [] : [profile.votes].flat();
  if (files.some(file => typeof file !== 'string' || !file.trim())) throw Error('Expected a path or list of paths to listening votes');
  if (profile.keyboard !== undefined && !['mechanical','laptop'].includes(profile.keyboard)) throw Error('Choose a mechanical or laptop keyboard');
  if (profile.bindings !== undefined && (!profile.bindings || typeof profile.bindings!=='object' || Array.isArray(profile.bindings) ||
      Object.values(profile.bindings).some(v=>typeof v!=='string'))) throw Error('Expected action-to-recipe bindings');
  if (profile.quietSignatures !== undefined && (!Array.isArray(profile.quietSignatures) ||
      profile.quietSignatures.some(slot => typeof slot !== 'string' || !slot.trim()))) throw Error('Expected a list of quiet signatures');
  if(profile.signatures!==undefined) {
    if(!profile.signatures || typeof profile.signatures!=='object' || Array.isArray(profile.signatures))throw Error('Expected project signatures');
    for(const choice of Object.values(profile.signatures)){
      if(!choice || typeof choice.id!=='string' || !Number.isInteger(choice.revision) || choice.revision<1 ||
        (choice.seed!==undefined && (!Number.isSafeInteger(choice.seed) || choice.seed<0 || choice.seed>0xffffffff)) ||
        (choice.trimDb!==undefined && (!Number.isFinite(choice.trimDb)||choice.trimDb < -92||choice.trimDb>92)) ||
        (choice.edgeDb!==undefined && (!Number.isFinite(choice.edgeDb)||choice.edgeDb < -12||choice.edgeDb>0))) throw Error('Invalid saved cue signature');
    }
  }
  const paths = files.map(file => resolve(dirname(path), file));
  return { ...profile, votes: paths.length > 1 ? paths : paths[0] };
}

export async function listeningVotes(file) {
  if (!file) return {};
  const votes = Object.create(null);
  for (const path of [file].flat()) {
    const review = JSON.parse(await readFile(path, 'utf8'));
    const source = review.votes ?? review.reviews;
    if (!source || typeof source !== 'object' || Array.isArray(source))
      throw Error('Expected listening votes or studio reviews');
    for (const [id, entry] of Object.entries(source)) {
      for (const vote of [entry].flat()) {
        if (!vote || typeof vote !== 'object') throw Error('Invalid listening vote for ' + id);
        const next = { ...vote, ...(vote.background && review.bed ? { bed: review.bed } : {}) };
        votes[id] = votes[id] ? [votes[id], next].flat() : next;
      }
    }
  }
  return { votes };
}

// An exact use and listening context win. Later ballots break ties within that scope.
export function applicableVote(votes, sound, useCase, context) {
  const history = votes?.[sound.id];
  if (!history) return;
  let best, specificity = -1;
  for (const vote of [history].flat()) {
    if ((vote.revision ?? 1) !== (sound.revision ?? 1) ||
        (vote.useCase && vote.useCase !== useCase) || (vote.context && vote.context !== (context ?? 'normal'))) continue;
    const score = Number(Boolean(vote.useCase)) + Number(Boolean(vote.context));
    if (score >= specificity) { best = vote; specificity = score; }
  }
  return best;
}

export const rejectedVote = vote => ['no', 'rejected'].includes(vote?.decision);
