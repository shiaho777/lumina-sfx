import acoustics from '../references/edits/palette-acoustics.json' with { type: 'json' };

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function levelMatch(from, to) {
  if (!acoustics[from] || !acoustics[to]) throw Error('Compare measured palette candidates');
  return acoustics[from].activeDb - acoustics[to].activeDb;
}

export function softerEdge(id, alternatives) {
  const current = acoustics[id];
  if (!current) return;
  return alternatives
    .filter((alt) => acoustics[alt]?.bright < current.bright * 0.85)
    .sort((a, b) => acoustics[a].bright - acoustics[b].bright)[0];
}

export function unpackContext(query) {
  const phrases = [
    [
      'speech',
      /\b(?:under(?:neath)?|beneath|behind|during|over|in|with)\s+(?:(?:a|the|my|our)\s+)?(?:spoken (?:walkthrough|demo|explanation)|voice[ -]?over|narration|dialogue|speech|someone (?:speaking|talking))\b/gi,
    ],
    [
      'speech',
      /\bwhile (?:someone|they|I|we|the narrator) (?:is |are |am )?(?:talking|speaking|narrating|explaining)\b/gi,
    ],
    [
      'rapid',
      /\b(?:in (?:rapid|quick|fast) succession|rapidly|quickly|repeatedly|rapid(?= (?:switch|tab|click|press|navigat))|during rapid navigation)\b/gi,
    ],
    ['hero', /\b(?:in |for )?(?:a |the )?(?:hero (?:shot|close[ -]?up)|featured close[ -]?up)\b/gi],
  ];
  const contexts = [];
  let character;
  query = query.replace(
    /\b(?:take (?:the )?(?:sharp )?edge off(?: (?:it|them))?|keep (?:the )?(?:sharpness|brightness) down|less (?:bright|sharp)|(?:soften|tame) (?:the )?(?:top end|edge|highs))\b/gi,
    () => {
      character = 'less-bright';
      return ' soft ';
    },
  );
  for (const [name, pattern] of phrases)
    query = query.replace(pattern, () => {
      if (!contexts.includes(name)) contexts.push(name);
      return ' ';
    });
  return { query: query.trim(), context: contexts[0], contexts, character };
}

export function observedOriginal(query) {
  return (
    /\b(?:already (?:audible|present|heard)|already (?:has|contains) (?:the |a )?(?:original )?(?:click|contact)|keep (?:the )?original (?:click|contact)|reuse (?:the )?(?:recorded|original) (?:contact|click|tap))\b/i.test(
      query,
    ) && !/\b(?:not|never|isn't|isn’t|barely|unsure|check (?:if|whether)|might be|if|whether)\b/i.test(query)
  );
}

export function contextOrder(ids, mode) {
  if (!mode) return ids;
  // Same-action alternatives only. Short and dark wears better across rapid changes;
  // a featured beat can carry a longer body, within its own action family.
  const cost = (id) => {
    const { bright, tailMs, bursts = 1 } = acoustics[id];
    return mode === 'hero'
      ? -Math.min(tailMs, 180) / 180 - bright * 0.3
      : (mode === 'speech' ? 3 : 1.5) * bright +
          Math.min(tailMs, 500) / (mode === 'rapid' ? 160 : 350) +
          Math.min(1, Math.max(0, bursts - 1) * 0.15);
  };
  const measured = ids.filter((id) => acoustics[id]).sort((a, b) => cost(a) - cost(b));
  return ids.map((id) => (acoustics[id] ? measured.shift() : id));
}

// Group actual rapid switches after reuse, silence and contact-budget decisions.
// Use one trim throughout the run so an identical switch never pulses up and down.
export function balanceRapidPresses(cues, fps) {
  const runs = new Map();
  function finish(run) {
    if (run.length < 4) return;
    let first = 0, busiest = 0;
    for (let i = 0; i < run.length; i++) {
      while (run[i].syncFrame - run[first].syncFrame > fps) first++;
      busiest = Math.max(busiest, i - first + 1);
    }
    const trim = Math.min(3, Math.max(0, busiest - 3));
    if (!trim) return;
    for (const cue of run) {
      cue.densityTrimDb = -trim;
      cue.gainDb = Math.max(-80, cue.gainDb - trim);
    }
  }
  const presses = cues.filter(cue => cue.decision === 'play' && cue.signature?.startsWith('press/') && !cue.keyFrames);
  for (const cue of presses.sort((a, b) => a.syncFrame - b.syncFrame)) {
    const run = runs.get(cue.signature) ?? [];
    if (cue.context !== 'rapid' || (run.length && cue.syncFrame - run.at(-1).syncFrame >= 0.45 * fps)) {
      finish(run);
      run.length = 0;
    }
    if (cue.context === 'rapid') run.push(cue);
    runs.set(cue.signature, run);
  }
  for (const run of runs.values()) finish(run);
}

export function scoreGain(actionDb, cue, frame, fps, mode, underSpeech, track, subtleDigital = false) {
  // Preserve impact on a featured reveal and a lower ceiling for everyday controls.
  const measured = acoustics[cue];
  const peakCeiling = subtleDigital ? -23 : mode === 'hero' ? -10 : -13;
  let activeCeiling = subtleDigital ? -36 : mode === 'hero' ? -21 : -25;
  // A quieter physical switch has a longer body. Match the whole rapid run by
  // active level so a soft-sounding switch cannot become the louder performance.
  if (mode === 'rapid' && ['desktop-mouse-press', 'quiet-mouse-press'].includes(cue)) activeCeiling = -36;
  else if (cue === 'quiet-mouse-press' && mode !== 'hero') activeCeiling = -33;
  const nominal = measured
    ? Math.min(actionDb, peakCeiling - measured.peakDb, activeCeiling - measured.activeDb)
    : actionDb;
  const base = nominal + (mode === 'rapid' ? -2 : 0);
  if (!track?.windows.length) return base - (underSpeech ? 6 : 0) - (subtleDigital ? 4 : 0);
  const sec = frame / fps;
  const lo = Math.max(0, Math.floor((sec - 0.05) / track.windowSec));
  const hi = Math.ceil((sec + 0.12) / track.windowSec);
  const local = track.windows.slice(lo, hi);
  if (!local.length) return base - (underSpeech ? 6 : 0) - (subtleDigital ? 4 : 0);
  const rms = 10 * Math.log10(Math.max(1e-12, local.reduce((v, x) => v + x.energy, 0) / local.length));
  const peak = Math.max(...local.map((x) => x.peak));
  const { activeDb, peakDb } = acoustics[cue] ?? { activeDb: -24, peakDb: -8 };
  const quietTrim = subtleDigital ? clamp((-46 - rms) / 8, 0, 4) : 0;
  const adjustment = underSpeech
    ? clamp(rms - 6 - (activeDb + base), -4, 2)
    : rms > -32
      ? clamp(rms - 5 - (activeDb + base), -2, 3)
      : 0;
  // Look at the attack itself. The broadband window can sound busy even when a key
  // lands on an open vowel, or quiet when its attack covers a short consonant.
  let speechTrim = 0;
  if (underSpeech && measured) {
    const end = sec + 0.025;
    let power = 0, presence = 0;
    for (let i = Math.floor(sec / track.windowSec); i < Math.ceil(end / track.windowSec); i++) {
      const w = track.windows[i];
      const overlap = Math.min(end, (i + 1) * track.windowSec) - Math.max(sec, i * track.windowSec);
      if (w && overlap > 0) {
        power += w.energy * overlap;
        presence += (w.presenceEnergy ?? 0) * overlap;
      }
    }
    const speechShare = clamp((presence / Math.max(power, 1e-15) - 0.04) / 0.26, 0, 1);
    const audible = clamp((10 * Math.log10(Math.max(presence / 0.025, 1e-12)) + 57) / 15, 0, 1);
    speechTrim = 4 * speechShare * audible * clamp(measured.bright / 0.26, 0, 1);
  }
  // Reserve headroom for the original on local peaks. Never turn down the source stream.
  const room = 20 * Math.log10(Math.max(0.015, 0.97 - peak)) - peakDb;
  return Number(Math.min(base + adjustment - quietTrim - speechTrim, room, peakCeiling - peakDb).toFixed(2));
}
