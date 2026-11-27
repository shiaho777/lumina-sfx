import { feedbackFor, physicalSwitch, returnKeyDown, spacebarDown } from './edit-device.mjs';
// One recurring screen gesture carries one identity throughout a cut. Direction is a
// performance constraint on a swipe, while material is a property of the family.
export function familySlot(e, signatures) {
  const feedback = feedbackFor(e, e.deviceKind);
  if (feedback === 'surface') return ['press/' + e.deviceKind + '/surface', e.family].filter(Boolean).join('/');
  if (feedback === 'digital') {
    const shared = ['touch-feedback', e.family].filter(Boolean).join('/');
    // Older profiles can intentionally bind a particular button to its original take.
    const previous = [(['press', 'paste', 'type'].includes(e.action) ? e.action + '/touch' : e.action), e.family]
      .filter(Boolean).join('/');
    if (!signatures?.[shared] && ['settings-focus-felt-tick', 'soft-touch-acknowledgement'].includes(signatures?.[previous]?.id)) return previous;
    return shared;
  }
  if (physicalSwitch(e)) return ['press/' + e.deviceKind, e.family].filter(Boolean).join('/');
  if (spacebarDown(e)) return ['press/' + e.deviceKind + '/spacebar', e.family].filter(Boolean).join('/');
  if (returnKeyDown(e)) return ['press/mechanical/return', e.family].filter(Boolean).join('/');
  const surface = e.physicalContact ? '/surface' : '';
  const physical = ['press', 'paste', 'type'].includes(e.action) ? '/' + e.deviceKind + surface : '';
  return [e.action + physical, e.family].filter(Boolean).join('/');
}

function material(choice, action) {
  return action === 'slide' ? choice.replace(/-(left|right)$/, '') : choice;
}

export function chooseFamilies(pending, profile) {
  const groups = new Map(),
    decisions = new Map();
  for (const item of pending) {
    if (!groups.has(item.slot)) groups.set(item.slot, []);
    groups.get(item.slot).push(item);
  }
  for (const [slot, items] of groups) {
    const scores = new Map(),
      saved = profile.signatures?.[slot];
    for (const { choices, event } of items) {
      for (const [rank, s] of choices.entries()) {
        const family = material(s.id, event.action);
        const v = scores.get(family) ?? { uses: 0, cost: 0, explicit: 0, saved: false };
        v.uses++;
        v.cost += rank;
        if (event.soundId === s.id) v.explicit++;
        if (saved && material(saved.id, event.action) === family && saved.revision === (s.revision ?? 1))
          v.saved = true;
        scores.set(family, v);
      }
    }
    const [family] = [...scores].sort(
      ([, a], [, b]) =>
        Number(b.saved) - Number(a.saved) || b.uses - a.uses || b.explicit - a.explicit || a.cost - b.cost,
    )[0];
    for (const entry of items) {
      const selected =
        entry.choices.find((s) => material(s.id, entry.event.action) === family) ?? entry.choices[0];
      const preference =
        saved &&
        material(saved.id, entry.event.action) === material(selected.id, entry.event.action) &&
        saved.revision === (selected.revision ?? 1)
          ? saved
          : undefined;
      decisions.set(entry.event.id, { selected, preference });
    }
  }
  return decisions;
}

export function approvedProfile(plan) {
  const signatures = Object.create(null);
  const quiet = new Set(plan.quietSignatures ?? []);
  for (const c of plan.cues) {
    if (c.locked && c.muted && c.projectQuiet && c.signature) quiet.add(c.signature);
    if (!c.locked || c.decision !== 'play' || !c.signature) continue;
    const prior = signatures[c.signature];
    const next = {
      id: c.soundId,
      revision: c.revision,
      trimDb: c.projectTrimDb ?? 0,
      ...(c.fixedTake && Number.isInteger(c.seed) ? { seed: c.seed } : {}),
      edgeDb: c.edgeDb ?? 0,
    };
    if (
      prior &&
      (material(prior.id, c.action) !== material(next.id, c.action) ||
        prior.trimDb !== next.trimDb ||
        prior.edgeDb !== next.edgeDb ||
        prior.revision !== next.revision)
    )
      throw Error(
        'Approved sounds disagree for ' + c.signature + '. Give the distinct control its own family.',
      );
    signatures[c.signature] = next;
  }
  for (const slot of Object.keys(signatures)) quiet.delete(slot);
  if (!Object.keys(signatures).length && !quiet.size)
    throw Error('Lock the chosen playing cues before exporting their project profile.');
  return { useCase: plan.useCase, palette: plan.palette, signatures, ...(quiet.size ? { quietSignatures: [...quiet] } : {}) };
}

// Compare audible identity across the delivered cut. Gain changes can follow narration or distance.
export function signatureChanges(cues) {
  const families = new Map();
  for (const cue of cues) {
    if (cue.decision !== 'play' || !cue.signature || !cue.soundId) continue;
    const name = material(cue.soundId, cue.action);
    const group = families.get(cue.signature) ?? new Map();
    const key = cue.fixedTake ? name + '#' + cue.seed : name;
    const take = group.get(key) ?? { material: name, frames: [] };
    take.frames.push(cue.syncFrame);
    group.set(key, take);
    families.set(cue.signature, group);
  }
  return [...families].filter(([, variants]) => variants.size > 1)
    .map(([signature, variants]) => ({ signature, variants: [...variants.values()] }));
}
