// Keep the source's identity separate from properties the renderer can supply.
export function worldPerformance(query, layer, viewpoint = '') {
  const [positive] = query.trim().split(/\b(?:without|excluding|not|no|never)\b/i);
  const exclusions = query.trim().slice(positive.length).replace(/^excluding\b/i, 'without');
  const veto = /^(?:without|no|not|never)\s+([a-z]+)[.,!]?$/i.exec(exclusions.trim())?.[1]?.toLowerCase();
  const contradiction = veto && (positive.toLowerCase().match(/[a-z]+/g) ?? []).includes(veto) ? veto : undefined;
  let text = positive;
  const discrete = /\b(?:single|one|1)\b/i.test(text) &&
    /\b(?:bounce|dribble|impact|tap|click|call|chirp|knock|step|strike|clap|crack|splash|hit|slam|snap)\b/i.test(text);
  const continuous = /\bcontinuous(?:ly)?\b/i.test(text);
  if (continuous && layer.durationSec) text = text.replace(/\bcontinuous(?:ly)?\b/gi, ' ');

  if (layer.placement?.path?.length)
    text = text.replace(/\b(?:passing|travelling|traveling)(?: (?:by|past the listener))?\b/gi, ' ');
  if (layer.placement?.obstruction !== undefined)
    text = text.replace(/\b(?:outside|beyond|behind|through) (?:the |a )?(?:side |closed |open )?window\b/gi, ' ');
  if (layer.placement && !layer.placement.path && /\b(?:bird|songbird|chirp|call)\b/i.test(text))
    text = text.replace(/\bperched(?: (?:outside|outdoors))?\b/gi, ' ');
  if (layer.placement && /\b(?:indoor|indoors|interior)\b/i.test(viewpoint))
    text = text.replace(/\brunning indoors\b/gi, 'running');

  const quiet = /^(?:a |the )?(?:quiet|faint|subdued)\b/i.test(text);
  if (quiet) text = text.replace(/^(a |the )?(?:quiet|faint|subdued)\s*/i, '$1');
  // A running fan has an adjustable speed. A low-frequency motor or a low-flying source is a different request.
  const lowSpeed = /\bfan\b/i.test(text) && /\blow (?:speed|steady)\b/i.test(text);
  if (lowSpeed) text = text.replace(/\blow (speed|steady)\b/gi, (_, next) => next.toLowerCase() === 'speed' ? ' ' : next);

  text = text.replace(/\b(?:naturally|gently)\s+(?=rustl|blow|sway|mov)/gi, '')
    .replace(/\b(?:natural|clear)\s+(?=(?:natural )?(?:wind|rustl|chirp|bird call|songbird))/gi, '')
    .replace(/\bsoft grass\b/gi, 'grass')
    .replace(/\bpractice (court|field|floor)\b/gi, '$1')
    .replace(/\bon (?=(?:the |a )?(?:dry |wet |indoor |outdoor |hardwood |wooden |concrete |paved |practice |court|pavement|asphalt|floor))/gi, ' ');
  return { query: (text + ' ' + exclusions).replace(/\s+/g, ' ').trim(), discrete, continuous, quiet, lowSpeed, contradiction };
}

// A catalog author may document a narrow approximation for a secondary detail.
// Every other source word must match. An exact match always wins, including over a project preference.
export function auditionSubstitutions(hit, query, exact) {
  if (!hit.missing.length) return [];
  if (exact || /\b(?:exact(?:ly)?|must|required|only|strictly)\b/i.test(query)) return;
  const words = ' ' + query.toLowerCase().split(/\b(?:without|excluding|not|no|never)\b/)[0].replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const evidence = (hit.closeMatches ?? []).filter(rule => {
    if (!hit.missing.includes(rule.term)) return false;
    let remaining = words;
    for (const phrase of rule.phrases) remaining = remaining.replaceAll(' ' + phrase + ' ', ' ');
    // A leather ball on a leather surface asks for two materials. The permitted
    // approximation for the ball cover cannot also stand in for its landing surface.
    return remaining !== words && !remaining.trim().split(/\s+/).some(token =>
      token === rule.term || token === rule.term + 's');
  });
  if (hit.missing.every(term => evidence.some(rule => rule.term === term))) return evidence;
}

// Keep the descriptions in the input while emitting IDs usable by the renderer and game adapters.
export function namedLayers(brief) {
  const names = new Map(), used = new Set();
  const reserved = new Set(brief.layers.map(layer => layer.label));
  for (const { label } of brief.layers) {
    if (label === undefined) continue;
    if (typeof label !== 'string' || !label.trim() || names.has(label)) throw Error('Use distinct nonempty layer labels');
    let stem = /^[a-z][a-z0-9-]*$/.test(label) ? label : label.toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!/^[a-z]/.test(stem) || /^layer\d+$/.test(stem)) stem = 'source-' + (stem || names.size + 1);
    let id = stem;
    for (let suffix = 2; used.has(id) || (id !== label && reserved.has(id)); suffix++) id = stem + '-' + suffix;
    used.add(id);
    names.set(label, id);
  }
  const ref = value => names.get(value) ?? value;
  function focus(value) {
    return Array.isArray(value.subjects) ? { ...value, subjects: value.subjects.map(ref) } : { ...value };
  }
  const layers = brief.layers.map(layer => {
    const next = { ...layer };
    if (next.label !== undefined) next.label = ref(next.label);
    for (const key of ['under', 'afterLayer', 'atMarker'])
      if (next[key] && typeof next[key].layer === 'string') next[key] = { ...next[key], layer: ref(next[key].layer) };
    return next;
  });
  if (!brief.focus) return { ...brief, layers };
  const adjusted = focus(brief.focus);
  if (Array.isArray(adjusted.moments)) adjusted.moments = adjusted.moments.map(focus);
  return { ...brief, layers, focus: adjusted };
}
