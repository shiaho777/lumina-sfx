import { clock, reviseEdit } from './edit-score.mjs';

// Match the two edits as sets. A repeated label is insufficient evidence to carry
// an approval to one particular occurrence, even when just one nearby frame aligns.
export function reconform(old, next, timeline, catalog) {
  const before = clock(old),
    after = clock(next);
  const oldById = new Map(old.cues.map((c) => [c.id, c]));
  const incoming = new Map(timeline.events.map((e) => [e.id, e]));
  const fingerprint = (c) => (c.target ? JSON.stringify([c.action, c.target, c.direction ?? '']) : null);
  const keyGroups = (cues) => {
    const groups = new Map();
    for (const c of cues) {
      const k = fingerprint(c);
      if (k) {
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(c);
      }
    }
    return groups;
  };
  const oldKeys = keyGroups(old.cues),
    newKeys = keyGroups(next.cues);
  const links = new Map(),
    used = new Set(),
    ambiguous = [],
    retained = [],
    added = [];
  const reserve = (c, prior) => {
    if (used.has(prior.id)) throw Error('More than one new cue claims ' + prior.id);
    links.set(c.id, prior);
    used.add(prior.id);
  };
  for (const c of next.cues) {
    const ref = incoming.get(c.id)?.previousId ?? c.id;
    if (oldById.has(ref)) reserve(c, oldById.get(ref));
    else if (incoming.get(c.id)?.previousId) throw Error('Unknown previousId ' + ref);
  }
  for (const c of next.cues) {
    if (links.has(c.id)) continue;
    const k = fingerprint(c),
      matches = oldKeys.get(k) ?? [];
    if (matches.length === 1 && newKeys.get(k).length === 1 && !used.has(matches[0].id))
      reserve(c, matches[0]);
    else if (matches.some((x) => x.locked)) ambiguous.push(c.id);
    else added.push(c.id);
  }
  const review = (c, why) => {
    c.decision = 'review';
    c.reason = why;
    if (!ambiguous.includes(c.id)) ambiguous.push(c.id);
  };
  const changes = [];
  for (const c of next.cues) {
    const prior = links.get(c.id);
    if (!prior?.locked) {
      if (ambiguous.includes(c.id))
        review(c, 'Several prior events share this action and target. Supply previousId.');
      continue;
    }
    if (
      prior.action !== c.action ||
      (c.direction ?? '') !== (prior.direction ?? '') ||
      (prior.device && c.device && prior.device !== c.device) ||
      (prior.target && c.target && prior.target !== c.target)
    ) {
      review(c, 'An approved cue now describes a different input or target.');
      continue;
    }
    if (prior.keyApprovals?.some(Boolean)) {
      const sameWord =
        c.keyFrames?.length === prior.keyFrames.length &&
        c.label === prior.label &&
        c.soundId === prior.soundId &&
        c.revision === prior.revision;
      if (!sameWord) {
        review(c, 'The approved typing performance changed. Check its new key marks.');
        continue;
      }
      const decisions = c.keyDecisions ?? c.keyFrames.map(() => 'play');
      const offsets = c.keyGainOffsets ?? c.keyFrames.map(() => 0);
      c.keyApprovals = c.keyFrames.map(() => null);
      let unresolved = false;
      for (const [i, choice] of prior.keyApprovals.entries()) {
        if (!choice) continue;
        const observed = c.sourceEvidence?.some((x) => x.frame === c.keyFrames[i]);
        if (!observed && choice.decision === 'reuse') {
          decisions[i] = 'review';
          c.sourceEvidence ??= [];
          c.sourceEvidence.push({
            frame: c.keyFrames[i],
            decision: 'review',
            reason: 'Previously reused contact absent from the new source scan',
          });
          unresolved = true;
        } else {
          decisions[i] = choice.decision === 'add' ? 'play' : 'reuse';
          offsets[i] += choice.trimDb;
          c.keyApprovals[i] = { ...choice };
        }
      }
      c.keyDecisions = decisions;
      c.keyGainOffsets = offsets;
      c.decision = decisions.includes('play') ? 'play' : decisions.includes('review') ? 'review' : 'reuse';
      if (unresolved) {
        c.reason = 'Verify the previously reused keys against the new original.';
        ambiguous.push(c.id);
        continue;
      }
    }
    if (c.decision === 'reuse') {
      c.locked = true;
      retained.push(c.id);
      continue;
    }
    if (prior.decision === 'reuse') {
      if (!c.sourceEvidence?.every((x) => x.decision === 'reuse') || !c.sourceEvidence.length) {
        review(c, 'Verify the original contact on this cut.');
        continue;
      }
      changes.push({ id: c.id, sourceDecision: 'reuse', lock: true });
      retained.push(c.id);
      continue;
    }
    if (prior.decision === 'silence') {
      if (c.decision === 'play') changes.push({ id: c.id, mute: true, lock: true });
      else if (!c.sourceEvidence) {
        c.decision = 'silence';
        c.locked = true;
      } else {
        review(c, 'Check the new source contact against the approved silence.');
        continue;
      }
      retained.push(c.id);
      continue;
    }
    if (
      c.decision !== 'play' ||
      (c.soundId !== prior.soundId && !c.alternatives?.includes(prior.soundId)) ||
      prior.revision !== (catalog.find((s) => s.id === prior.soundId)?.revision ?? 1)
    ) {
      review(c, 'The approved take or source observation changed.');
      continue;
    }
    const shift = Math.round(
      ((prior.syncFrame - (prior.pictureSyncFrame ?? prior.syncFrame)) / before.fps) * after.fps,
    );
    if (
      [c.syncFrame, c.frame, ...(c.keyFrames ?? [])].some(
        (f) => f + shift < 0 || f + shift >= after.durationFrames,
      )
    ) {
      review(c, 'Approved offset would fall outside this cut.');
      continue;
    }
    changes.push({
      id: c.id,
      ...(c.soundId !== prior.soundId ? { soundId: prior.soundId } : {}),
      ...(shift ? { shiftFrames: shift } : {}),
      lock: true,
    });
    c.seed = prior.seed;
    c.edgeDb = prior.edgeDb ?? 0;
    retained.push(c.id);
  }
  const result = changes.length ? reviseEdit(next, changes, catalog) : next;
  for (const c of result.cues) {
    const prior = links.get(c.id);
    if (!retained.includes(c.id) || c.decision !== 'play') continue;
    const trim = prior.projectTrimDb ?? 0;
    c.gainDb = Math.max(-80, Math.min(12, c.gainDb + trim - (c.projectTrimDb ?? 0)));
    c.projectTrimDb = trim;
  }
  result.recut = {
    retained,
    added,
    review: ambiguous,
    removed: old.cues.filter((c) => !used.has(c.id)).map((c) => c.id),
  };
  return result;
}
