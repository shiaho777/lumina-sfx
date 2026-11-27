// Keep the model's screening lead separate from the disposition of two listened takes.
import { createHash } from 'node:crypto';
import { renderChannels } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';

export function resolveSourceReview(recipe, raw, evidence, seeds) {
  if (!evidence) return { cleanHold: raw?.labels };
  const valid = seeds.every((seed, index) => {
    const wav = encodeWav(renderChannels(recipe, { seed }));
    return createHash('sha256').update(Buffer.from(wav)).digest('hex') === evidence.hashes[index];
  });
  const unseen = raw?.labels.some((label) => !evidence.labels.includes(label));
  if (unseen) return { cleanHold: raw.labels, sourceReview: 'recheck' };
  if (!valid) return { cleanHold: ['changed since audition'], sourceReview: 'recheck' };
  const cleared = evidence.status === 'retained' || evidence.status === 'repaired';
  const fieldContents =
    evidence.status === 'field'
      ? evidence.incidental?.filter((x) => ['bird', 'insect'].includes(x))
      : undefined;
  return {
    cleanHold: cleared ? undefined : (raw?.labels ?? evidence.labels),
    sourceReview: evidence.status,
    fieldContents,
  };
}
