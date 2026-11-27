import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { renderEdit } from './edit-render.mjs';
import { clock, reviseEdit } from './edit-score.mjs';
import { mixPicture, comparePictures } from './edit-media.mjs';

export function familyPassage(plan, signature, seconds = 5) {
  const { fps, durationFrames } = clock(plan);
  const width = Math.min(durationFrames, Math.max(1, Math.round(seconds * fps)));
  const marks = [];
  for (const cue of plan.cues) {
    if (cue.signature !== signature || cue.decision !== 'play' || cue.locked) continue;
    for (const [i, frame] of (cue.keyFrames ?? [cue.syncFrame]).entries())
      if (!cue.keyDecisions || cue.keyDecisions[i] === 'play') marks.push(frame);
  }
  if (!marks.length) throw Error('No editable, audible contacts for ' + signature);
  marks.sort((a, b) => a - b);
  let first = 0, best = 0, count = 0;
  for (let end = 0; end < marks.length; end++) {
    while (marks[end] - marks[first] >= width) first++;
    if (end - first + 1 > count) { best = first; count = end - first + 1; }
  }
  const mid = (marks[best] + marks[best + count - 1]) / 2;
  const start = Math.max(0, Math.min(durationFrames - width, Math.ceil(mid - width / 2)));
  return { start: start / fps, end: (start + width) / fps, contacts: count };
}

export async function auditionCue(
  plan,
  catalog,
  source,
  id,
  alternate,
  out,
  stream = 0,
  { quieter = false, sourceFrame, signature } = {},
) {
  if (quieter && alternate) throw Error('Choose a quieter audition or an alternative take');
  if (signature && (id || sourceFrame !== undefined)) throw Error('Choose a cue or a recurring signature');
  const passage = signature && familyPassage(plan, signature);
  const proposed = plan.cues.find((c) => c.id === id);
  const review = Boolean(
    proposed?.sourceEvidence &&
    (proposed.decision !== 'play' || proposed.keyDecisions?.includes('review') || sourceFrame !== undefined),
  );
  if (sourceFrame !== undefined && !review) throw Error('Choose a frame with an observed original contact');
  const change = (settings) => ({ ...(signature ? { signature } : { id }), ...(sourceFrame !== undefined ? { sourceFrame } : {}), ...settings });
  const without = review
    ? reviseEdit(plan, [change({ sourceDecision: 'reuse', lock: false })], catalog)
    : reviseEdit(plan, [change({ lock: false, mute: true })], catalog);
  if (review) plan = reviseEdit(plan, [change({ sourceDecision: 'add', lock: false })], catalog);
  const cue = signature ? plan.cues.find(c => c.signature === signature && c.decision === 'play' && !c.locked) : plan.cues.find(c => c.id === id);
  if (cue?.decision !== 'play') throw Error('Choose a playing cue to audition');
  if (sourceFrame !== undefined && alternate)
    throw Error('Choose a quieter or original comparison for one contact');
  const other = quieter || sourceFrame !== undefined ? undefined : (alternate ?? (signature ? undefined : cue.alternatives?.[0]));
  if (other && !cue.alternatives?.includes(other))
    throw Error('Choose a compatible alternative listed in the plan');
  const comparison = other ? { soundId: other } : { trimDb: -4 };
  const dest = resolve(out);
  await mkdir(dirname(dest), { recursive: true });
  if (
    await stat(dest).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    })
  )
    throw Error('Choose a new audition folder');
  const stage = await mkdtemp(join(dirname(dest), '.lumina-cue-'));
  try {
    const variants = [
      ['selected', plan],
      ['without', without],
      [
        'alternate',
        reviseEdit(
          plan,
          [
            change({
              ...(sourceFrame !== undefined ? { sourceDecision: 'add' } : {}),
              lock: false,
              ...comparison,
            }),
          ],
          catalog,
        ),
      ],
    ];

    const trims = {};
    for (const [label, score] of variants) {
      const stem = join(stage, 'stem.wav');
      await renderEdit(score, catalog, stem);
      const movie = label + '.mp4';
      const delivery = await mixPicture(source, stem, join(stage, movie), stream);
      trims[movie] = delivery.deliveryTrimDb;
      await rm(stem);
    }
    // Give the original track the same playback gain in every comparison. Preserve the
    // deliberate difference between adding a cue, lowering it and leaving it silent.
    const sharedDb = Math.min(...Object.values(trims));
    const volumes = Object.fromEntries(Object.entries(trims).map(([name, db]) => [name, 10 ** ((sharedDb - db) / 20)]));
    await comparePictures(
      join(stage, 'selected.mp4'),
      join(stage, 'without.mp4'),
      join(stage, 'listen.html'),
      join(stage, 'alternate.mp4'),
      {
        'selected.mp4': [change({ ...(review ? { sourceDecision: 'add' } : {}), lock: true })],
        'without.mp4': [change({ ...(review ? { sourceDecision: 'reuse' } : { mute: true }), lock: true })],
        'alternate.mp4': [
          change({ ...(review ? { sourceDecision: 'add' } : {}), ...comparison, lock: true }),
        ],
      },
      { passage, volumes },
    );
    await rename(stage, dest);
    return {
      desk: join(dest, 'listen.html'),
      ...(signature ? { signature, passage } : { cue: id }),
      selected: cue.soundId,
      alternative: other ?? null,
      ...(other ? {} : { quieterDb: -4 }),
    };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
