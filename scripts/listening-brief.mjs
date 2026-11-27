import { auditionSubstitutions, worldPerformance, namedLayers } from './world-brief.mjs';
import { applicableVote, rejectedVote } from './selection-profile.mjs';
import { geometryConflict, sourcePerspective, mountedAmbience, roomForContact } from './source-perspective.mjs';
// The coding agent supplies action, viewpoint and emphasis from the user's words.
// Resolve requested performances against the installed catalog before rendering anything.
import { unpackContext } from './edit-context.mjs';
import { silentGesture } from './editorial-intent.mjs';
import { rankPerformance } from './intent-search.mjs';
function fitsPerformance(sound, layer, single = false) {
  const start = layer.fromMarker === undefined ? 0 : sound.markers?.[layer.fromMarker];
  if (!Number.isFinite(start) || start < 0 || start >= sound.durationSec) return false;
  if (layer.fitSec !== undefined) {
    // The renderer computes the exact fit with its reverb tail. Leave room effects to it.
    if (layer.durationSec !== undefined || layer.macros?.speed !== undefined) return false;
    if (!layer.macros?.space || layer.macros.space === 'dry') {
      const rate = (sound.durationSec - start) / layer.fitSec;
      if (!(rate >= 0.25 && rate <= 4)) return false;
    }
  }
  return (
    !layer.durationSec || (single && !sound.loopable) ||
    sound.loopable ||
    layer.durationSec <= (sound.durationSec - start) / (layer.macros?.speed ?? 1) + 1e-8
  );
}
function worldCompatible(sound, placement) {
  const view = sourcePerspective(sound);
  if (!view.local && !sound.tags.includes('menu')) return true;
  return view.physicalInput && (placement.acoustics || (placement.placement && placement.placement.kind !== 'listener'));
}

function reviewReason(sound, settings, design) {
  if (design.sourcePolicy === 'clean') {
    if (sound.cleanHold || sound.auditionNote) return 'needs-audition';
    if (sound.isolation !== 'isolated') return 'needs-isolation';
  }
  if (sound.missing.length) return 'missing-terms';
  if (design.scope === 'world' && !worldCompatible(sound, settings)) return 'interface-only';
  if (geometryConflict(sound, settings)) return 'perspective-conflict';
  if (!fitsPerformance(sound, settings)) return 'marker-or-duration';
}

export function resolveListeningBrief(brief, bank, profile = {}) {
  if (
    brief.schemaVersion !== 2 ||
    !Array.isArray(brief.layers) ||
    !brief.layers.length ||
    brief.layers.length > 32
  )
    throw Error('Expected a version 2 brief with 1–32 named layers');
  const { layers, palette, ...design } = namedLayers(brief);
  if ((palette ?? profile.palette) && !['soft', 'crisp'].includes(palette ?? profile.palette))
    throw Error('Choose a soft or crisp palette');
  design.balance ??=
    design.focus?.marginDb !== undefined || design.focus?.moments?.length ? 'directed' : 'natural';
  if (design.balance === 'directed' && design.focus) design.focus = { timing: 'local', ...design.focus };
  design.sourcePolicy ??= 'clean';
  const cleanBank = bank.filter(
    (s) => design.sourcePolicy !== 'clean' || (s.isolation === 'isolated' && !s.cleanHold && !s.auditionNote),
  );
  const resolved = [],
    warnings = [],
    missing = [];
  for (const layer of layers) {
    const { query, prefer, exclude, exactSource = false, ...settings } = layer;
    if (typeof exactSource !== 'boolean') throw Error('exactSource must be true or false');
    if (typeof query !== 'string' || !query.trim() || settings.id !== undefined)
      throw Error('Use one audible query per brief layer');
    if (silentGesture(query)) {
      warnings.push({ label: layer.label, decision: 'silence' });
      continue;
    }
    // The distance model supplies the requested perspective for free-text sources.
    // Keep exact IDs literal so an incompatible authored performance goes to review.
    const worldLayer = design.scope === 'world' || Boolean(settings.acoustics ||
      (settings.placement && settings.placement.kind !== 'listener'));
    const mounted = (worldLayer && !prefer && !exclude) ?
      mountedAmbience(query, layer.label, design.viewpoint) : undefined;
    const mountedTake = mounted && cleanBank.find(s => s.id === mounted);
    const worldQuery = worldLayer && !bank.some(sound => sound.id === query.trim().toLowerCase());
    const intent = worldQuery ? worldPerformance(query, settings, design.viewpoint) : { query };
    if (intent.contradiction) {
      missing.push({ query, label: layer.label, reason: 'The requested source also excludes ' + intent.contradiction });
      continue;
    }
    if (intent.quiet && settings.gain === undefined && !settings.under) settings.gain = 0.56;
    const rank = entries => rankPerformance(entries, intent.query, exclude ?? '', profile.votes,
      { palette: palette ?? profile.palette, useCase: profile.useCase, signatures: profile.signatures }, settings);
    const exactId = bank.find(sound => sound.id === query.trim().toLowerCase())?.id;
    const context = unpackContext(query).context;
    const vetoedInProject = sound => rejectedVote(applicableVote(profile.votes, sound, profile.useCase, context));
    const matches = rank(cleanBank).filter(hit => !vetoedInProject(hit));
    const matchesSource = hit => exactId ? hit.id === exactId :
      !hit.missing.length || (worldQuery && auditionSubstitutions(hit, query, exactSource) !== undefined);
    const hits = matches.filter(hit => matchesSource(hit) &&
      (!intent.discrete || !hit.loopable) && (!intent.continuous || hit.loopable || hit.durationSec >= (settings.durationSec ?? 0)) &&
      (!intent.lowSpeed || hit.params?.speed));
    if (mountedTake && !vetoedInProject(mountedTake) && fitsPerformance(mountedTake, settings)) hits.unshift(mountedTake);
    const terms =
      String(prefer ?? '')
        .toLowerCase()
        .match(/[a-z0-9]+/g) ?? [];
    const preference = (hit) => {
      const words = new Set(
        [hit.id, hit.perspective, ...hit.tags]
          .join(' ')
          .toLowerCase()
          .match(/[a-z0-9]+/g),
      );
      return terms.filter((t) => words.has(t)).length;
    };
    hits.sort((a, b) => Number(b.id === query) - Number(a.id === query) || preference(b) - preference(a));
    if (design.scope === 'world') {
      for (let i = hits.length - 1; i >= 0; i--)
        if (!worldCompatible(hits[i], settings)) hits.splice(i, 1);
    }
    const conflict = hits.length && geometryConflict(hits[0], settings);
    // Match source duration and time controls before committing to a take.
    const compatible = hits.filter((s) => !geometryConflict(s, settings) && fitsPerformance(s, settings, intent.discrete));
    if (settings.durationSec && settings.placement?.path?.length)
      compatible.sort((a, b) => Number(b.loopable) - Number(a.loopable));
    if (!compatible.length) {
      // Evidence for repairing the brief. A held recording never becomes a playable substitute.
      const candidates = (design.sourcePolicy === 'clean' ? rank(bank) : matches)
        .filter(hit => !exactId || hit.id === exactId).slice(0, 3)
        .map(hit => ({ id: hit.id, issue: vetoedInProject(hit) ? 'project-rejected' : reviewReason(hit, settings, design), missingTerms: hit.missing }));
      missing.push({
        candidates,
        query,
        label: layer.label,
        reason:
          conflict ||
          (hits.length && hits.every((s) => !fitsPerformance(s, settings))
            ? 'Available performances do not cover the requested marker or duration'
            : 'No eligible source matched the requested action and source policy'),
      });
      continue;
    }
    // A precise material/size match wins even when a nearby take has preferred tags.
    const hit = compatible.find(sound => !sound.missing?.length) ?? compatible[0];
    for (const item of hit.missing?.length ? auditionSubstitutions(hit, query, exactSource) ?? [] : [])
      warnings.push({ label: settings.label, decision: 'approximation', unverified: item.term, note: item.note });
    if (intent.lowSpeed && settings.params?.speed === undefined) {
      const { min, max } = hit.params.speed;
      settings.params = { ...settings.params, speed: min + (max - min) * 0.2 };
    }
    const naturalDuration = (hit.durationSec - (hit.markers?.[settings.fromMarker] ?? 0)) / (settings.macros?.speed ?? 1);
    if (intent.discrete && !hit.loopable && naturalDuration < settings.durationSec && settings.fitSec === undefined) {
      warnings.push({label:settings.label, decision:'natural-end', requestedWindowSec:settings.durationSec, naturalDurationSec:naturalDuration});
      delete settings.durationSec;
    }
    if (worldLayer && hit.mixRole === 'vehicle' && settings.placement?.path?.length &&
        settings.placement.kind !== 'listener' && settings.placement.doppler === undefined &&
        !sourcePerspective(hit).motion)
      settings.placement = { ...settings.placement, doppler: true };
    if (sourcePerspective(hit).local && !settings.placement && !settings.acoustics)
      settings.placement = { kind: 'listener' };
    if (sourcePerspective(hit).local) settings.placement ??= { kind: 'listener' };
    if (
      !settings.placement &&
      !settings.acoustics &&
      /cockpit|pilot inside|inside (?:the )?canopy/i.test(design.viewpoint ?? '')
    ) {
      if (hit.tags.includes('turbofan'))
        settings.acoustics = { source: 'turbine', distanceM: 3.5, bearingDeg: 150, elevationDeg: -7 };
      else if (hit.tags.includes('thunder') && !sourcePerspective(hit).distance)
        settings.acoustics = {
          source: 'thunder',
          distanceM: 686,
          bearingDeg: -37,
          elevationDeg: 12,
          through: 'canopy',
        };
      else if (hit.tags.includes('rain') && hit.tags.includes('canopy'))
        settings.acoustics = { source: 'rainfall', distanceM: 1.4, bearingDeg: 8, elevationDeg: 39 };
    }
    Object.assign(settings, roomForContact(hit, settings, design));
    const overlaps = resolved.find((other) => {
      if (other.event && settings.event && other.event !== settings.event) return false;
      if (other.afterLayer || other.atMarker || settings.afterLayer || settings.atMarker) return false;
      const already = cleanBank.find((s) => s.id === other.id);
      if (hit.id !== other.id && !hit.components?.some((c) => already.components?.includes(c))) return false;
      const a = other.offsetSec ?? 0,
        b = settings.offsetSec ?? 0;
      return (
        a + (other.durationSec ?? other.fitSec ?? already.durationSec) > b &&
        b + (settings.durationSec ?? settings.fitSec ?? hit.durationSec) > a
      );
    });
    if (overlaps) {
      missing.push({
        query,
        label: layer.label,
        reason:
          'Shares an overlapping physical source with ' +
          overlaps.label +
          '. Use one performance or name distinct emitters.',
      });
      continue;
    }
    resolved.push({ id: hit.id, ...settings });
    if (hit.contains?.length) warnings.push({ label: layer.label, alreadyContains: hit.contains });
  }
  if (!resolved.length && !missing.length) return { decision: 'silence', design: null, warnings, missing };
  if (!design.scope)
    design.scope = resolved.some((l) => cleanBank.find((s) => s.id === l.id)?.mixRole === 'interface')
      ? 'mixed'
      : 'world';
  // A partial audition lets an agent hear useful evidence before refining a missing source.
  // Keep relative offsets and gains only when their named predecessors are present.
  let audition;
  if (missing.length && resolved.length) {
    const names = new Set();
    const playable = resolved.filter(layer => {
      const anchors = [layer.under, layer.afterLayer, layer.atMarker].filter(Boolean);
      if (anchors.some(anchor => !names.has(anchor.layer))) return false;
      names.add(layer.label ?? layer.id);
      return true;
    });
    if (playable.length) {
      const { focus, ...base } = design;
      audition = { ...base, balance: 'natural', layers: playable };
    }
  }
  return {
    decision: missing.length ? 'review' : 'resolved',
    ...(missing.length ? { resolvedLayers: resolved.map(({label, id}) => ({label, id})) } : {}),
    ...(audition ? { audition } : {}),
    missing,
    warnings,
    design: missing.length ? null : { ...design, layers: resolved },
  };
}
