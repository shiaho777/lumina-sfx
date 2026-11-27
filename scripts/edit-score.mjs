import { observedSlide, cropScreenPath } from './edit-travel.mjs';
import { applicableVote } from './selection-profile.mjs';
import { editorialPicks, featuredLanding, markedGraphicLanding, silentGesture } from './editorial-intent.mjs';
import { rankByIntent } from './intent-search.mjs';
import { chooseFamilies, familySlot } from './edit-family.mjs';
import { deviceKind, describesSurfaceContact, feedbackFor, physicalSwitch, returnKeyDown, spacebarDown, excludedTraits, stripButtonLabel } from './edit-device.mjs';
import {
  balanceRapidPresses,
  contextOrder,
  levelMatch,
  scoreGain,
  softerEdge,
  unpackContext,
  observedOriginal,
} from './edit-context.mjs';

// A picture event owns its sound. Words printed inside the interface do not describe the source.
const basic = {
  press: ['desktop-mouse-press', 'glass-trackpad-press'],
  tab: ['settings-tab-walnut-detent', 'settings-subtab-porcelain-tip'],
  'toggle-on': ['settings-toggle-engage-brass'],
  'toggle-off': ['settings-toggle-off-cork'],
  type: ['laptop-scissor-keyboard-key-down', 'gasket-mount-keyboard-key-down'],
  slide: ['silk-swipe-left', 'silk-swipe-right'],
  drag: ['menu-item-lifted-for-dragging'],
  snap: ['menu-item-snaps-into-a-slot'],
  confirm: ['settings-apply-overcentre-latch'],
  back: ['settings-back-suede-release'],
  cut: ['soft-air-match-cut'],
  logo: ['logo-felt-signature'],
};
const optional = {
  focus: 'settings-focus-felt-tick',
  scroll: 'settings-slider-knurled-index',
  undo: 'edit-undo-return',
  redo: 'edit-redo-seat',
  disabled: 'settings-list-edge-felt-bumper',
};
const quiet = new Set([
  'stream',
  'hold',
  'hover',
  'cursor',
  'reading',
  'code-output',
  'autofill',
  'spinner',
  'progress',
  'loading',
  'animation',
  'auto-reveal',
]);
const motionAccents = new Set(['wipe', 'whip', 'land', 'rise', 'swell', 'reveal']);
const optIn = new Set(['slide', 'cut', 'logo', 'focus', 'scroll', 'scrub', ...motionAccents]);
const weight = {
  snap: 8,
  'toggle-on': 7,
  'toggle-off': 7,
  tab: 6,
  confirm: 6,
  back: 6,
  type: 5,
  paste: 5,
  drag: 4,
  press: 3,
  slide: 2,
  focus: 1,
  cut: 1,
  logo: 1,
};
function eventPriority(event) {
  return event.priority ?? (event.physicalContact ? 9 : (weight[event.action] ?? 0));
}
const db = {
  press: -1,
  tab: -1,
  'toggle-on': 0,
  'toggle-off': 0,
  type: -3,
  paste: -3,
  slide: -5,
  logo: -6,
  cut: -5,
  focus: -5,
};
export const defaultPalette = Object.values(basic).flat();
export function eligible(s) {
  return s && s.isolation === 'isolated' && !s.cleanHold && !s.auditionNote;
}
function stableSeed(name) {
  let seed = 2166136261;
  for (const c of name) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  return seed >>> 0;
}
function integer(value, name, lo, hi) {
  if (!Number.isSafeInteger(value) || value < lo || value > hi) throw Error('Invalid ' + name + ': ' + value);
  return value;
}
export function clock(input) {
  if (typeof input.fps !== 'number' && !(typeof input.fps === 'string' && /^\d+\/\d+$/.test(input.fps)))
    throw Error('Supply a numeric or rational project fps');
  const [num, den = 1] = String(input.fps).split('/').map(Number),
    fps = num / den;
  if (!Number.isFinite(fps) || fps < 1 || fps > 240) throw Error('Invalid picture frame rate');
  const durationFrames = integer(input.durationFrames, 'picture duration', 1, Number.MAX_SAFE_INTEGER);
  return { fps, durationFrames };
}
const namePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/;
function checkEvent(e, ids, durationFrames) {
  if (!e || !namePattern.test(e.id ?? '') || typeof e.id !== 'string' || ids.has(e.id))
    throw Error('Missing, invalid or duplicate cue ID: ' + e?.id);
  ids.add(e.id);
  if (typeof e.action !== 'string' || !e.action) throw Error('Supply an observed action for ' + e.id);
  integer(e.frame, 'cue frame', 0, durationFrames - 1);
  if (e.endFrame !== undefined) integer(e.endFrame, 'end frame', e.frame + 1, durationFrames);
  if (e.syncFrame !== undefined)
    integer(
      e.syncFrame,
      'sync frame',
      e.frame,
      e.endFrame === undefined ? durationFrames - 1 : Math.min(e.endFrame, durationFrames - 1),
    );
  if (e.motion !== undefined &&
      (e.action !== 'slide' || !['accent', 'follow'].includes(e.motion) || e.endFrame === undefined))
    throw Error('Set motion to accent or follow on a slide with an end frame');
  if (e.motion === 'follow' && (e.endFrame - e.frame < 2 ||
      (e.syncFrame !== undefined && (e.syncFrame <= e.frame || e.syncFrame >= e.endFrame))))
    throw Error('Place the sweep accent inside the visible motion');
  for (const field of ['accent', 'underSpeech', 'muted', 'physicalContact'])
    if (e[field] !== undefined && typeof e[field] !== 'boolean') throw Error('Expected boolean ' + field);
  if (e.gesture !== undefined && (typeof e.gesture !== 'string' || !e.gesture))
    throw Error('Supply a gesture ID');
  for (const field of ['device', 'target', 'label', 'key'])
    if (e[field] !== undefined && typeof e[field] !== 'string') throw Error('Expected text for ' + field);
  if (e.family !== undefined && (typeof e.family !== 'string' || !namePattern.test(e.family)))
    throw Error('Invalid cue family');
  if (e.priority !== undefined && !Number.isFinite(e.priority)) throw Error('Expected numeric priority');
  if (e.sourceContact !== undefined && ![true, false, 'uncertain'].includes(e.sourceContact))
    throw Error('Expected an observed sourceContact');
  if (e.keyFrames !== undefined) {
    if (e.action !== 'type' || !Array.isArray(e.keyFrames) || !e.keyFrames.length)
      throw Error('keyFrames require observed typing');
    e.keyFrames.forEach((f, i) =>
      integer(
        f,
        'keystroke frame',
        i ? e.keyFrames[i - 1] + 1 : e.frame,
        Math.min(durationFrames - 1, e.endFrame ?? durationFrames - 1),
      ),
    );
  }
}
function optionsFor(e, palette, mode) {
  if (e.soundId) return [e.soundId];
  if (feedbackFor(e, e.deviceKind) === 'surface')
    return [e.deviceKind === 'touch' ? 'fingertip-on-display-glass' : 'stylus-tip-on-tablet-glass'];
  if (feedbackFor(e, e.deviceKind) === 'digital') return ['soft-touch-acknowledgement'];
  const board = /gasket|thock/i.test(e.device ?? '') ? 'gasket-mount' : 'linear-mechanical';
  if (returnKeyDown(e)) return ['linear-mechanical-keyboard-return-down'];
  if (spacebarDown(e)) return [e.deviceKind === 'keyboard'
    ? 'laptop-scissor-keyboard-spacebar-down' : 'linear-mechanical-keyboard-spacebar-down'];
  const physical = {
    'pen-button': ['stylus-barrel-press'],
    trackball: ['trackball-press'],
    trackpad: [basic.press[1]],
    mouse: [basic.press[0], 'quiet-mouse-press'],
    unspecified: [basic.press[0], 'quiet-mouse-press'],
    keyboard: [basic.type[0]],
    mechanical: [board + '-keyboard-key-down'],
    controller: ['settings-focus-felt-tick'],
  };
  if (e.action === 'paste' && ['keyboard', 'mechanical'].includes(e.deviceKind))
    return [
      e.deviceKind === 'mechanical' ? board + '-keyboard-shortcut' : 'laptop-scissor-keyboard-shortcut',
    ];
  if (physicalSwitch(e)) return physical[e.deviceKind];
  if (e.action === 'press' || e.action === 'paste') return physical[e.deviceKind] ?? [];
  if (e.action === 'type')
    return e.deviceKind === 'mechanical'
      ? physical.mechanical
      : ['unspecified', 'keyboard'].includes(e.deviceKind)
        ? [basic.type[0]]
        : [];
  if (e.action === 'slide')
    return ['left', 'right'].includes(e.direction)
      ? ['silk-swipe-' + e.direction, 'velvet-swipe-' + e.direction]
      : [];
  if (e.action === 'tab' && palette === 'crisp') return [...basic.tab].reverse();
  if (e.action === 'notice') return ['menu-confirm-pluck', 'menu-confirm-spring-detent'];
  // A controller confirmation lands at button-down. A two-stage settings latch has a quieter
  // second contact and its louder pre-travel can fall several frames before the visible input.
  if (e.action === 'confirm' && e.deviceKind === 'controller') return ['menu-confirm-spring-detent', ...basic.confirm];
  if (e.action === 'confirm') return [...basic.confirm, 'menu-confirm-spring-detent'];
  if (e.action === 'cut') return [...basic.cut, 'linen-match-cut'];
  if (e.action === 'logo') return [...basic.logo, 'delicate-logo-close'];
  if (e.action === 'land') {
    const featured = mode === 'hero' || featuredLanding(e.brief ?? '');
    const seats = editorialPicks('land');
    return featured ? [...seats].reverse() : seats;
  }
  if (motionAccents.has(e.action) || ['scrub', 'drop'].includes(e.action))
    return editorialPicks(e.action) ?? [];
  return [...(basic[e.action] ?? (optional[e.action] ? [optional[e.action]] : []))];
}
function pick(e, profile, votes, bank, mode) {
  const baseIds = contextOrder(optionsFor(e, profile.palette, mode), mode);
  const saved = profile.signatures?.[familySlot(e, profile.signatures)];
  const preferred = profile.bindings?.[e.action];
  const oldTouch = 'settings-focus-felt-tick';
  if (baseIds[0] === 'soft-touch-acknowledgement' &&
      (preferred === oldTouch || (saved?.id === oldTouch && saved.revision === bank.get(oldTouch)?.revision)))
    baseIds.push(oldTouch);
  // Saved projects can continue using the old gasket board across future edits.
  const legacy = baseIds[0]?.replace('linear-mechanical-keyboard-', 'gasket-mount-keyboard-');
  if (e.deviceKind === 'mechanical' && !e.soundId && !returnKeyDown(e) && !spacebarDown(e) && legacy && !baseIds.includes(legacy) &&
      (preferred === legacy || (saved?.id === legacy && saved.revision === bank.get(legacy)?.revision)))
    baseIds.unshift(legacy);
  if (!e.soundId && preferred && baseIds.includes(preferred))
    baseIds.splice(0, baseIds.length, preferred, ...baseIds.filter((id) => id !== preferred));
  const choices = baseIds
    .map((id) => bank.get(id))
    .filter(eligible)
    .filter(s => e.motion !== 'follow' || s.gestureTiming === 'native')
    .filter(
      (s) =>
        !excludedTraits(e.avoid).some((word) =>
          [s.id, ...s.tags]
            .join(' ')
            .toLowerCase()
            .split(/[\s-]+/)
            .includes(word),
        ),
    );
  const use = profile.useCase;
  const preference = (s) => {
    const ballot = applicableVote(votes, s, use, mode);
    if (!ballot) return 0;
    return ['no', 'rejected'].includes(ballot.decision)
      ? -1
      : ['yes', 'approved'].includes(ballot.decision)
        ? 1
        : 0;
  };
  return choices.filter((s) => preference(s) >= 0).sort((a, b) => preference(b) - preference(a));
}
function ordinaryShortcut(e, sound, mode) {
  return (
    e.action === 'paste' && sound.tags.includes('keyboard') && sound.tags.includes('chord') && mode !== 'hero'
  );
}
function performance(e, s, fps, project, mode, speechAt, track) {
  const speed =
    e.action === 'slide' && e.endFrame !== undefined
      ? Math.max(0.85, Math.min(1.25, (s.durationSec * fps) / (e.endFrame - e.frame)))
      : 1;
  const marker = s.markers ?? {};
  const markerSec =
    marker.seat ?? marker.commit ?? marker.apex ?? marker.contact ?? marker.step ?? marker.release ?? 0;
  // Center a brief accent on visible motion; fitting a short swipe to an entire slow pan would pitch it down.
  const frame =
    e.syncFrame ??
    (e.action === 'slide' && e.endFrame !== undefined ? Math.floor((e.frame + e.endFrame) / 2) : e.frame);
  const actionDb = familySlot(e).startsWith('press/') ? db.press : (db[e.action] ?? -2);
  // Controller browsing has a lighter detent than the commit at the end of a menu run.
  const browseTrim = e.deviceKind === 'controller' && e.action === 'focus' ? 3 : 0;
  const base = actionDb - browseTrim + (e.deviceKind === 'touch' ? -4 : 0);
  // A chord exposes several switch transients where a normal selection exposes one.
  const compound = ordinaryShortcut(e, s, mode);
  const digital = feedbackFor(e, e.deviceKind) === 'digital';
  const gainAt = (f) =>
    scoreGain(base, s.id, f, fps, mode, speechAt(f), track, digital) - (compound ? 3.5 : 0);
  return {
    soundId: s.id,
    revision: s.revision ?? 1,
    seed: stableSeed(project + '/' + e.id),
    syncFrame: frame,
    pictureSyncFrame: frame,
    markerSec,
    speed,
    gainDb: gainAt(e.keyFrames?.[0] ?? frame),
    ...(e.keyFrames?.length && track
      ? { keyGainOffsets: e.keyFrames.map((f) => Number((gainAt(f) - gainAt(e.keyFrames[0])).toFixed(2))) }
      : {}),
    ...(e.keyFrames ? { keyFrames: e.keyFrames } : {}),
  };
}
// Imported edit timelines may have separate input and state markers. Pair only unambiguous observations.
function inputOwners(events, fps) {
  const states = new Map(),
    matches = new Map(),
    paired = new Map();
  const transitions = new Set([
    'tab',
    'toggle-on',
    'toggle-off',
    'confirm',
    'commit',
    'back',
    'snap',
    'undo',
    'redo',
    'disabled',
  ]);
  for (const e of events) {
    if (e.gesture || !transitions.has(e.action)) continue;
    if (!states.has(e.frame)) states.set(e.frame, []);
    states.get(e.frame).push(e);
  }
  for (const e of events) {
    if (e.action !== 'press' || e.gesture) continue;
    const candidates = [];
    const last = e.frame + (e.target ? Math.floor(0.08 * fps) : 0);
    for (let frame = e.frame; frame <= last; frame++) {
      for (const state of states.get(frame) ?? []) if (state.target === e.target) candidates.push(state.id);
    }
    if (candidates.length !== 1) continue;
    const [state] = candidates;
    if (!matches.has(state)) matches.set(state, []);
    matches.get(state).push(e.id);
  }
  for (const [state, presses] of matches) if (presses.length === 1) paired.set(presses[0], state);
  return paired;
}
function interruptedSlides(events) {
  const previous = new Map(), replacements = new Map();
  for (const event of [...events].sort((a, b) => a.frame - b.frame)) {
    if (event.action !== 'slide' || !event.target || event.muted || !['left', 'right'].includes(event.direction))
      continue;
    const prior = previous.get(event.target);
    if (prior && prior.endFrame > event.frame && prior.direction !== event.direction) {
      const apex = prior.syncFrame ?? Math.floor((prior.frame + prior.endFrame) / 2);
      replacements.set(prior, apex >= event.frame
        ? { ...prior, muted: true, interrupted: true }
        : { ...prior, endFrame: event.frame, syncFrame: apex, screenPath: cropScreenPath(prior.screenPath, (event.frame-prior.frame)/(prior.endFrame-prior.frame)) });
    }
    previous.set(event.target, event);
  }
  return events.map(e => replacements.get(e) ?? e);
}

export function observeEdit(input, catalog) {
  if (!Array.isArray(input.events))
    throw Error('Supply observed picture events; an empty list scores a silent edit.');
  if (!input.events.some(e => e?.brief !== undefined || e?.travel !== undefined || e?.travelRegion !== undefined)) return input;
  return {
    ...input,
    events: input.events.map((e) => {
      if (e?.brief === undefined) return observedSlide(e);
      if (typeof e.brief !== 'string' || !e.brief.trim()) throw Error('Supply a nonempty cue brief');
      const style = unpackContext(e.brief);
      const landing = !e.action && markedGraphicLanding(e);
      const intent = landing ? 'land' : !e.action &&
        rankByIntent(catalog, e.brief, '', true).find((x) => !x.missing.length)?.editorialAction;
      const action =
        e.action ??
        { key: 'type', typing: 'type', grab: 'drag', close: 'logo' }[intent] ??
        intent ??
        'unresolved';
      const describedDevice = stripButtonLabel(style.query);
      return observedSlide({
        ...e,
        action,
        ...(e.physicalContact === undefined && describesSurfaceContact(action, e.brief) ? { physicalContact: true } : {}),
        ...(landing && silentGesture(e.brief) ? { muted: true } : {}),
        device: e.device ?? (deviceKind(describedDevice) !== 'unknown' ? describedDevice : undefined),
        context: e.context ?? style.context,
        underSpeech: e.underSpeech ?? (style.contexts.includes('speech') || undefined),
        briefEdge: style.character === 'less-bright' ? -4 : undefined,
        sourceContact: e.sourceContact ?? (observedOriginal(e.brief) || undefined),
        ...(action === 'slide' && !e.direction && /\b(left|right)\b/i.test(style.query)
          ? { direction: style.query.match(/\b(left|right)\b/i)[1].toLowerCase() }
          : {}),
      });
    }),
  };
}

export function planEdit(input, catalog, profile = {}, votes = {}, track) {
  return scoreObservedEdit(observeEdit(input, catalog), catalog, profile, votes, track);
}

export function scoreObservedEdit(input, catalog, profile, votes, track) {
  const { fps, durationFrames } = clock(input);
  const bank = new Map(catalog.map((s) => [s.id, s])),
    ids = new Set(),
    groups = new Map();
  const project = input.id ?? 'picture';
  const speech = input.speech ?? [];
  if (!Array.isArray(speech)) throw Error('Expected speech frame ranges');
  for (const span of speech) {
    if (!Array.isArray(span) || span.length !== 2) throw Error('Supply [firstFrame, endFrame] for speech');
    integer(span[0], 'speech start', 0, durationFrames - 1);
    integer(span[1], 'speech end', span[0] + 1, durationFrames);
  }
  const style = { ...profile, useCase: profile.useCase ?? input.format ?? 'product' };
  for (const e of input.events) checkEvent(e, ids, durationFrames);
  for (const config of [input, ...input.events]) {
    if (config.feedback !== undefined && !['natural', 'none', 'subtle'].includes(config.feedback))
      throw Error('Unknown feedback policy');
    if (
      config.avoid !== undefined &&
      (!Array.isArray(config.avoid) || config.avoid.some((s) => typeof s !== 'string' || !s.trim()))
    )
      throw Error('Expected an array of excluded sound traits');
    if (config.device !== undefined && typeof config.device !== 'string')
      throw Error('Expected a device name');
    if (config.context !== undefined && !['normal', 'rapid', 'hero', 'speech'].includes(config.context))
      throw Error('Unknown audition context');
  }
  if (input.maxAddedContacts !== undefined)
    integer(input.maxAddedContacts, 'added-contact budget', 0, Number.MAX_SAFE_INTEGER);
  input = { ...input, events: interruptedSlides(input.events) };
  const paired = inputOwners(input.events, fps);
  for (const e of input.events) {
    const group = e.gesture ? 'gesture/' + e.gesture : 'cue/' + (paired.get(e.id) ?? e.id);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(e);
  }
  const cues = [],
    pending = [];
  const priority = new Map(input.events.map((e) => [e.id, eventPriority(e)]));
  for (const events of groups.values()) {
    const ranked = [...events].sort((a, b) => eventPriority(b) - eventPriority(a) || a.frame - b.frame);
    const existing = ranked.find((e) => e.sourceContact === true);
    const uncertain = ranked.find((e) => e.sourceContact === 'uncertain');
    const contact = ranked.find((x) => ['press', 'type', 'paste'].includes(x.action) && x.device);
    const avoid = [...(input.avoid ?? []), ...events.flatMap((x) => x.avoid ?? [])].map((x) =>
      x.trim().toLowerCase(),
    );
    const quietGesture = ranked.some((x) => x.feedback === 'none');
    let owner;
    for (const event of ranked) {
      const device =
        event.device ??
        contact?.device ??
        input.device ??
        (['type', 'paste'].includes(event.action) ? style.keyboard : undefined);
      const e = {
        ...event,
        device,
        deviceKind: deviceKind(device),
        key: event.key ?? contact?.key,
        feedback: quietGesture ? 'none' : (event.feedback ?? contact?.feedback ?? input.feedback),
        avoid,
      };
      const policy = feedbackFor(e, e.deviceKind);
      const out = {
        id: e.id,
        frame: e.frame,
        ...(e.endFrame !== undefined ? { endFrame: e.endFrame } : {}),
        action: e.action,
        ...(e.deviceKind !== 'unspecified' ? { device: e.deviceKind } : {}),
        ...(e.gesture ? { gesture: e.gesture } : {}),
        ...(e.target ? { target: e.target } : {}),
        ...(e.direction ? { direction: e.direction } : {}),
        ...(e.motion ? { motion: e.motion } : {}),
        ...(e.screenPath && e.motion === 'follow' ? {screenPath: e.screenPath} : {}),
        ...(e.label ? { label: e.label } : {}),
      };
      const navigation =
        ['controller', 'keyboard', 'mechanical'].includes(e.deviceKind) &&
        ['scroll', 'focus'].includes(e.action);
      const slot = familySlot(e, style.signatures);
      const projectQuiet = !e.soundId && style.quietSignatures?.includes(slot);
      const silent =
        projectQuiet ||
        e.muted ||
        policy === 'silence' ||
        quiet.has(e.action) ||
        (optIn.has(e.action) && !navigation && !e.accent && e.motion !== 'follow' && !e.soundId);
      if (existing)
        Object.assign(out, {
          decision: event === existing ? 'reuse' : 'silence',
          reason: 'Original audio carries this gesture',
        });
      else if (silent) Object.assign(out, { decision: 'silence', reason: projectQuiet ? 'This gesture is quiet in the project profile' : e.interrupted ? 'Motion reversed before the accent' : 'Picture carries this beat' });
      else if (e.motionReview) Object.assign(out, { decision: 'review', reason: e.motionReview });
      else if (uncertain || owner || policy === 'review')
        Object.assign(out, {
          decision: owner ? 'silence' : 'review',
          reason: owner
            ? 'Covered by ' + owner
            : uncertain
              ? 'Check source audio at this gesture'
              : 'Identify the physical contact or reuse the original',
        });
      else {
        const speechAt = (f) =>
          event.underSpeech ??
          (events.some((x) => x.underSpeech) || speech.some(([lo, hi]) => lo <= f && f < hi));
        const underSpeech = (e.keyFrames ?? [e.syncFrame ?? e.frame]).some(speechAt);
        const nearby = ['tab', 'focus', 'scroll', 'press', 'confirm', 'back', 'toggle-on', 'toggle-off'].includes(e.action) &&
          input.events.some(x => {
            if (events.includes(x) || x.muted || x.sourceContact === 'uncertain' ||
                Math.abs(x.frame - e.frame) / fps >= 0.45) return false;
            const peer = { ...x, deviceKind: deviceKind(x.device ?? input.device), feedback: x.feedback ?? input.feedback };
            if (feedbackFor(peer, peer.deviceKind) === 'silence') return false;
            // A mouse can open, confirm and close three different states with the same physical switch.
            return physicalSwitch(e) && physicalSwitch(peer)
              ? familySlot(e) === familySlot(peer)
              : x.action === e.action && peer.deviceKind === e.deviceKind && x.family === e.family;
          });
        const mode = e.context ?? input.context ?? (underSpeech ? 'speech' : nearby ? 'rapid' : undefined);
        const [sound, ...alternatives] = pick(e, style, votes, bank, mode === 'normal' ? undefined : mode);
        if (!sound || (e.action === 'type' && !e.keyFrames && e.endFrame !== undefined)) {
          Object.assign(out, {
            decision: 'review',
            reason: sound
              ? 'Spot the visible key-down frames'
              : e.motion === 'follow' ? 'Choose a directional sweep with native gesture timing'
                : 'Choose a clean match for this action or direction',
          });
        } else {
          owner = e.id;
          out.decision = 'play';
          pending.push({
            out,
            event: e,
            slot: familySlot(e, style.signatures),
            choices: [sound, ...alternatives],
            mode,
            speechAt,
          });
        }
      }
      cues.push(out);
    }
  }
  const families = chooseFamilies(pending, style);
  for (const { out, event, slot, choices, mode, speechAt } of pending) {
    const { selected, preference } = families.get(event.id);
    const perf = performance(event, selected, fps, project, mode, speechAt, track);
    const trim = preference?.trimDb ?? 0;
    const fixed = [
      'slide',
      'cut',
      'tab',
      'focus',
      'scroll',
      'toggle-on',
      'toggle-off',
      'back',
      'confirm',
      'notice',
      'logo',
    ].includes(event.action);
    // A multi-contact hotkey in a short narration break can jump out between words.
    const inSpeechGap =
      event.action === 'paste' &&
      !mode &&
      speech.some(([, end]) => end <= event.frame && (event.frame - end) / fps < 2) &&
      speech.some(([start]) => start > event.frame && (start - event.frame) / fps < 2);
    const compound = ordinaryShortcut(event, selected, mode);
    const softMouse = (style.palette ?? 'soft') === 'soft' && physicalSwitch(event) &&
      event.deviceKind === 'mouse' && mode !== 'hero' && selected.id === 'desktop-mouse-press';
    const edgeTrim = preference?.edgeDb ?? event.briefEdge ?? (softMouse ? -3 : inSpeechGap ? -3 : compound ? -2 : 0);
    const feedback = feedbackFor(event, event.deviceKind);
    const fixedTake = fixed || motionAccents.has(event.action) || physicalSwitch(event) || feedback === 'digital' || feedback === 'surface';
    Object.assign(out, perf, {
      ...(fixedTake ? { fixedTake: true } : {}),
      ...((motionAccents.has(event.action) || event.action === 'slide') && event.endFrame !== undefined ? { fitMotion: true } : {}),
      gainDb: Math.max(-80, Math.min(12, perf.gainDb + trim - (inSpeechGap || softMouse ? 2 : 0))),
      projectTrimDb: trim,
      seed: fixedTake
        ? (preference?.seed ??
          stableSeed(project + '/' + slot + '/' + selected.id.replace(/-(left|right)$/, '')))
        : perf.seed,
      ...(edgeTrim ? { edgeDb: edgeTrim } : {}),
      signature: slot,
      perspective: 'listener',
      device: event.deviceKind,
      context: mode ?? 'normal',
      alternatives: choices.filter((s) => s.id !== selected.id).map((s) => s.id),
    });
  }
  const cuesById = new Map(cues.map((c) => [c.id, c]));
  // An observed press and its state change may be marked a frame apart.
  for (const events of groups.values()) {
    const possible = events
      .filter((e) => e.sourceContact !== false)
      .flatMap((e) => track?.contacts?.[e.id] ?? []);
    if (!possible.length || events.some((e) => e.sourceContact !== undefined)) continue;
    const playing = events.map((e) => cuesById.get(e.id)).find((c) => c.decision === 'play');
    if (!playing) continue;
    if (playing.keyFrames?.length) {
      playing.keyDecisions = playing.keyFrames.map(
        (frame) => possible.find((hit) => hit.frame === frame)?.decision ?? 'play',
      );
      playing.decision = wordDecision(playing.keyDecisions);
    } else playing.decision = possible.every((x) => x.decision === 'reuse') ? 'reuse' : 'review';
    playing.sourceEvidence = possible;
    playing.reason =
      playing.decision === 'reuse'
        ? 'Matches a confirmed original contact'
        : 'A short original transient coincides with the input. Audition original and added contact.';
  }
  if (input.maxAddedContacts !== undefined) {
    let remaining = input.maxAddedContacts;
    const ordered = cues
      .filter((c) => c.decision === 'play')
      .sort((a, b) => priority.get(b.id) - priority.get(a.id) || a.frame - b.frame);
    for (const cue of ordered) {
      const count = addedContacts(cue);
      if (count <= remaining) remaining -= count;
      else {
        // A typed phrase is one observed performance. Keep its timing intact when the budget is too small.
        for (const field of [
          'soundId',
          'revision',
          'seed',
          'syncFrame',
          'markerSec',
          'speed',
          'gainDb',
          'keyFrames',
          'keyGainOffsets',
          'keyDecisions',
          'sourceEvidence',
          'alternatives',
        ])
          delete cue[field];
        Object.assign(cue, {
          decision: 'silence',
          reason: 'Reserved the requested contacts for higher-priority gestures',
        });
      }
    }
  }
  balanceRapidPresses(cues, fps);
  // A finished stroke and its return belong to the same moving object. Let the sweep
  // occupy the frames around each accent. A deliberate hold between them stays quiet.
  const latestSlide = new Map();
  for (const cue of [...cues].sort((a, b) => a.frame - b.frame)) {
    if (cue.action !== 'slide' || !cue.target || cue.decision !== 'play') continue;
    const prior = latestSlide.get(cue.target);
    if (prior?.endFrame === cue.frame && prior.direction !== cue.direction &&
        prior.soundId.replace(/-(left|right)$/, '') === cue.soundId.replace(/-(left|right)$/, '')) {
      prior.motion ??= 'turn';
      cue.motion ??= 'turn';
    }
    latestSlide.set(cue.target, cue);
  }
  return {
    schemaVersion: 1,
    id: project,
    fps: input.fps,
    durationFrames,
    useCase: style.useCase,
    ...(style.quietSignatures?.length ? { quietSignatures: [...style.quietSignatures] } : {}),
    palette: style.palette ?? 'soft',
    ...(input.maxAddedContacts !== undefined ? { maxAddedContacts: input.maxAddedContacts } : {}),
    cues: cues.sort((a, b) => a.frame - b.frame || a.id.localeCompare(b.id)),
  };
}
function wordDecision(keys) {
  return keys.includes('play') ? 'play' : keys.includes('review') ? 'review' : 'reuse';
}
function addedContacts(cue) {
  if (cue.decision !== 'play') return 0;
  return cue.keyDecisions?.filter((d) => d === 'play').length ?? cue.keyFrames?.length ?? 1;
}
export function reviseEdit(plan, changes, catalog) {
  const next = structuredClone(plan),
    seen = new Set(),
    { fps, durationFrames } = clock(plan);
  if (!Array.isArray(changes) || !changes.length) throw Error('Supply an array of cue changes');
  const familyMutes = new Set();
  const expanded = changes.flatMap((change) => {
    if (!change.action && !change.signature) return [change];
    if ([change.id, change.action, change.signature].filter(v => v !== undefined).length !== 1)
      throw Error('Address a cue by id, action or signature');
    const { action, signature, ...settings } = change;
    const matches = next.cues.filter(c => !c.locked && (c.decision === 'play' || c.muted) &&
      (signature ? c.signature === signature : c.action === action));
    if (!matches.length) throw Error('No scored cues for ' + (signature ?? action));
    return matches.map(c => {
      const edit = { ...settings, id: c.id };
      if (signature && settings.mute && settings.lock === true) familyMutes.add(c.id);
      if (signature && edit.character === 'less-bright') {
        if (edit.soundId !== undefined || edit.edgeTrimDb !== undefined)
          throw Error('Choose a tone trim or a replacement take');
        delete edit.character;
        edit.edgeTrimDb = -4;
      }
      if (signature && edit.soundId) {
        // Resolve the corresponding left/right performance of the same material.
        if (c.action === 'slide' && c.direction)
          edit.soundId = edit.soundId.replace(/-(left|right)$/, '-' + c.direction);
        if (c.soundId !== edit.soundId && !c.alternatives?.includes(edit.soundId))
          throw Error('The replacement is incompatible with ' + c.id);
      }
      return edit;
    });
  });
  for (const change of expanded) {
    const {
      id,
      mute,
      gainDb,
      trimDb,
      edgeTrimDb,
      shiftFrames,
      soundId: requestedSound,
      lock,
      character,
      sourceDecision,
      sourceFrame,
      ...other
    } = change;
    let soundId = requestedSound;
    const cue = next.cues.find((c) => c.id === id);
    if (
      !cue ||
      seen.has(id) ||
      Object.keys(other).length ||
      [mute, gainDb, trimDb, edgeTrimDb, shiftFrames, soundId, lock, character, sourceDecision].every(
        (v) => v === undefined,
      )
    )
      throw Error('Invalid edit for ' + id);
    seen.add(id);
    if (lock !== undefined && typeof lock !== 'boolean') throw Error('Expected boolean lock');
    if (
      cue.locked &&
      lock !== false &&
      [mute, gainDb, trimDb, edgeTrimDb, shiftFrames, soundId, character, sourceDecision].some((x) => x !== undefined)
    )
      throw Error('Unlock the approved cue before revising ' + id);
    if (lock !== undefined) cue.locked = lock;
    if (
      sourceFrame !== undefined &&
      (!cue.keyFrames?.includes(sourceFrame) ||
        !sourceDecision ||
        !cue.sourceEvidence?.some((x) => x.frame === sourceFrame))
    )
      throw Error('Choose a frame with an observed source contact');
    if (
      sourceFrame !== undefined &&
      [requestedSound, character, edgeTrimDb, shiftFrames, mute].some((v) => v !== undefined)
    )
      throw Error('Set sound, timing or mute on the complete cue');
    if (sourceDecision !== undefined) {
      if (!cue.sourceEvidence || !['reuse', 'add'].includes(sourceDecision))
        throw Error('Expected an observed original contact');
      const decision = sourceDecision === 'add' ? 'play' : 'reuse';
      if (cue.keyDecisions) {
        cue.keyDecisions = cue.keyDecisions.map((old, i) =>
          cue.sourceEvidence.some(
            (x) => x.frame === cue.keyFrames[i] && (sourceFrame === undefined || x.frame === sourceFrame),
          )
            ? decision
            : old,
        );
        cue.decision = wordDecision(cue.keyDecisions);
      } else cue.decision = decision;
      if (cue.keyFrames && cue.keyDecisions) {
        cue.keyApprovals ??= cue.keyFrames.map(() => null);
        for (const [i, frame] of cue.keyFrames.entries()) {
          if (
            (sourceFrame === undefined || frame === sourceFrame) &&
            cue.sourceEvidence.some((x) => x.frame === frame)
          )
            cue.keyApprovals[i] = { decision: sourceDecision, trimDb: cue.keyApprovals[i]?.trimDb ?? 0 };
        }
      } else cue.sourceChoice = sourceDecision;
      if (
        sourceDecision === 'reuse' &&
        [mute, gainDb, trimDb, edgeTrimDb, shiftFrames, soundId, character].every((v) => v === undefined)
      )
        continue;
    }
    if ([mute, gainDb, trimDb, edgeTrimDb, shiftFrames, soundId, character, sourceDecision].every((x) => x === undefined))
      continue;
    if (mute !== undefined && typeof mute !== 'boolean') throw Error('Expected boolean mute');
    if (cue.decision !== 'play' && !(cue.soundId && cue.muted))
      throw Error('Revise source observations before adding sound to ' + id);
    if (edgeTrimDb !== undefined) {
      if (!Number.isFinite(edgeTrimDb) || Math.abs(edgeTrimDb) > 12 || character !== undefined)
        throw Error('Use one treble trim within 12 dB');
      cue.edgeDb = Math.max(-12, Math.min(0, (cue.edgeDb ?? 0) + edgeTrimDb));
    }
    if (character !== undefined) {
      if (character !== 'less-bright' || soundId !== undefined)
        throw Error('Specify less-bright or a replacement take');
      soundId = softerEdge(cue.soundId, cue.alternatives ?? []);
      if (!soundId) cue.edgeDb = Math.max(-12, (cue.edgeDb ?? 0) - 4);
    }
    if (soundId !== undefined) {
      const sound = catalog.find((s) => s.id === soundId);
      if (!eligible(sound)) throw Error('Replacement needs a clean, reviewed source for ' + id);
      if (cue.motion === 'follow' && sound.gestureTiming !== 'native')
        throw Error('Choose a replacement that can follow the marked motion');
      if (cue.alternatives?.includes(sound.id)) {
        cue.gainDb = Math.max(-80, Math.min(12, cue.gainDb + levelMatch(cue.soundId, sound.id)));
        cue.alternatives = [cue.soundId, ...cue.alternatives.filter((id) => id !== sound.id)];
      } else if (cue.soundId !== sound.id) cue.alternatives = [];
      cue.soundId = sound.id;
      cue.revision = sound.revision ?? 1;
      const m = sound.markers ?? {};
      cue.markerSec = m.seat ?? m.commit ?? m.apex ?? m.contact ?? m.step ?? m.release ?? 0;
      if (cue.fitMotion && cue.action === 'slide')
        cue.speed = Math.max(0.85, Math.min(1.25, sound.durationSec * fps / (cue.endFrame - cue.frame)));
      else cue.speed = 1;
    }
    if (gainDb !== undefined || trimDb !== undefined) {
      if (gainDb !== undefined && trimDb !== undefined)
        throw Error('Specify absolute gain or a relative trim');
      if (sourceFrame !== undefined) {
        if (gainDb !== undefined) throw Error('Use a relative trim for one observed key');
        const index = cue.keyFrames.indexOf(sourceFrame);
        const offsets = cue.keyGainOffsets ?? cue.keyFrames.map(() => 0);
        const nextOffset = offsets[index] + trimDb;
        if (!Number.isFinite(nextOffset) || Math.abs(nextOffset) > 60) throw Error('Invalid key trim');
        cue.keyGainOffsets = offsets.map((value, i) => (i === index ? nextOffset : value));
        cue.keyApprovals[index].trimDb += trimDb;
      } else {
        const gain = trimDb === undefined ? gainDb : cue.gainDb + trimDb;
        if (!Number.isFinite(gain) || gain < -80 || gain > 12) throw Error('Invalid gainDb');
        cue.projectTrimDb = (cue.projectTrimDb ?? 0) + gain - cue.gainDb;
        cue.gainDb = gain;
      }
    }
    if (shiftFrames !== undefined) {
      integer(shiftFrames, 'frame shift', -durationFrames, durationFrames);
      cue.frame = integer(cue.frame + shiftFrames, 'frame', 0, durationFrames - 1);
      cue.syncFrame = integer(cue.syncFrame + shiftFrames, 'sync frame', 0, durationFrames - 1);
      if (cue.endFrame !== undefined)
        cue.endFrame = integer(cue.endFrame + shiftFrames, 'end frame', cue.frame + 1, durationFrames);
      if (cue.sourceEvidence)
        cue.sourceEvidence = cue.sourceEvidence.map((e) => ({ ...e, frame: e.frame + shiftFrames }));
      if (cue.keyFrames)
        cue.keyFrames = cue.keyFrames.map((f) =>
          integer(f + shiftFrames, 'key frame', 0, durationFrames - 1),
        );
    }
    if (mute !== undefined) {
      cue.muted = mute;
      if (familyMutes.has(id)) cue.projectQuiet = true;
      else delete cue.projectQuiet;
      cue.decision = mute ? 'silence' : cue.keyDecisions ? wordDecision(cue.keyDecisions) : 'play';
    }
  }
  if (
    next.maxAddedContacts !== undefined &&
    next.cues.reduce((n, c) => n + addedContacts(c), 0) > next.maxAddedContacts
  )
    throw Error('Revision exceeds the contact budget. Mute another cue in the same edit.');
  next.cues.sort((a, b) => a.frame - b.frame || a.id.localeCompare(b.id));
  return next;
}
