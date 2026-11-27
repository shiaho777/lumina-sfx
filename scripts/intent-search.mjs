import { applicableVote, rejectedVote } from './selection-profile.mjs';
import { deviceKind } from './edit-device.mjs';
import { contextOrder, unpackContext } from './edit-context.mjs';
import { contactQuery, excludedTraits, ambiguousPenRequest } from './edit-device.mjs';
import {eligibleForIntent} from './source-policy.mjs';
import { editorialBrief, editorialTerms, listeningOrder, paletteAffinity, silentGesture } from './editorial-intent.mjs';

// Offline retrieval over the catalog. Keep exact search available for asset IDs and scripts.
const stopWords = new Set('a an the of to for from with at that when my me you i want need please sound sounds effect effects sfx something scene setting feeling mood by near make like as and in it is through going really very just feels more only solo alone'.split(' '));
const vocabulary = {
  rustling:'rustle', reeds:'reed', leaves:'leaf', tires:'tire', tyres:'tire', tyre:'tire', indoors:'indoor', outdoors:'outdoor', chirping:'chirp',
  rainfall: 'rain', telephone: 'phone', ringing: 'ring',
  taxiing:'taxi', idling:'idle', cruises:'cruise', throttling:'throttle', changes:'change', rises:'rise', gains:'gain', arrives:'arrive', goes:'go', grabs:'grab', grabbing:'grab', releases:'release', snaps:'snap',
  rolls:'roll', rolling:'roll', hitting:'hit', cruising:'cruise', clucking:'cluck', clucks:'cluck',
  blocks:'block', collapses:'collapse', starts:'start', ignition:'start', flyover:'flyby',
  strokes:'stroke', breaks:'break', breaking:'break', livestock:'farm',
  birds:'bird', insects:'insect',
  landing: 'land', lands: 'land', settles: 'settle', settling: 'settle', transitions: 'transition',
  buttons: 'button', trailers: 'trailer', videos: 'video', reveals: 'reveal', logos: 'logo',
  one: 'single', slides: 'slide', notifications: 'notification', selection: 'select', selects: 'select', typed: 'type', turns: 'turn', screens: 'screen', panels: 'panel',
  quick: 'fast', swish: 'whoosh', swooshy: 'whoosh', opens: 'opening',
  closes: 'close', closing: 'close', closed: 'close', appears: 'reveal', appearing: 'reveal',
  confirmation: 'confirm', confirming: 'confirm', titles: 'title', cards: 'card',
  interfaces: 'interface', whipcut: 'whip',
  thocky: 'thock', thocking: 'thock', leftward: 'left', rightward: 'right',
  keystrokes: 'key', keycap: 'key', keycaps: 'key', keydown: 'press', keyup: 'release', enter: 'return',
  crackling: 'crackle', crackles: 'crackle', thunderstorm: 'storm', presses: 'press', pressing: 'press',
  footsteps: 'footstep', steps: 'step', wooden: 'wood', hardwood: 'wood', floors: 'floor',
  ordinary: 'normal', standard: 'normal', regular: 'normal',
  keyboards: 'keyboard', keystroke: 'key', keypress: 'key', swipes: 'swipe', swiping: 'swipe', swoosh: 'whoosh', swooshes: 'whoosh', whooshes: 'whoosh',
  relaxing: 'calm', relaxed: 'calm', tranquil: 'calm', soothing: 'calm', peaceful: 'calm', chilled: 'calm',
  intense: 'dramatic', suspenseful: 'dramatic', tense: 'dramatic',
  seaside: 'beach', shoreline: 'shore', waves: 'surf',
  tabs: 'tab', tabbed: 'tab', switching: 'switch', changing: 'switch', switched: 'switch',
  clicks: 'click', clicky: 'click', clicking: 'click', clicked: 'click', selecting: 'select',
  settings: 'settings', options: 'settings', preferences: 'settings', menus: 'menu',
  hovering: 'focus', hover: 'focus', scrolling: 'scroll', quieter: 'quiet', subtle: 'quiet',
  softer: 'soft', muted: 'soft', backing: 'back', returning: 'return',
  knobs: 'dial', knob: 'dial', sliding: 'slider', applying: 'apply',
  kills: 'elimination', kill: 'elimination', eliminated: 'elimination', credited: 'confirm',
  missiles: 'missile', phew: 'whistle', whistling: 'whistle', receding: 'departure',
  outgoing: 'departure', away: 'departure', flyaway: 'departure',
};
function words(value) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(word => vocabulary[word] ?? word);
}

export function rankByIntent(sounds, query, exclude = '', explain = false, votes = {}, options = {}) {
  if (silentGesture(query)) return [];
  const spotted=unpackContext(query);
  query = contactQuery(spotted.query);
  if (silentGesture(query) || ambiguousPenRequest(query)) return [];
  if (options.palette && !['soft','crisp'].includes(options.palette)) throw Error('Expected palette soft or crisp');
  const directedQuery = query.replace(/\b(left|right)\s+to\s+(left|right)\b/gi, (_, start, end) => end);
  const queryWords = words(directedQuery.replace(/\bsliding (panel|screen|page)/gi, 'slide $1').replace(/\bon (?:a|an|the)\b/gi, ' '));
  const isMood = term => term === 'calm' || term === 'dramatic';
  const negators = new Set(['not', 'never', 'without', 'no']);
  const moods = [...new Set(queryWords.filter((term, i) => isMood(term) && !negators.has(queryWords[i-1])))];
  // A trailing exclusion describes unwanted layers, not another search subject.
  const negated = [...query.toLowerCase().matchAll(/\b(?:without|no|not|never)\s+([^,.;!?]+)/g)]
    .flatMap(match => words(match[1].split(/\b(?:with|but|then)\b/i)[0]).filter(term => !stopWords.has(term)));
  const tokens = [...new Set(queryWords.filter(term => !stopWords.has(term) && !negators.has(term) && !negated.includes(term)))];
  const wantedMoods = moods.filter(term => !negated.includes(term));
  const mood = wantedMoods.length === 1 ? wantedMoods[0] : undefined;
  // In editing briefs an unspecified keyboard or mouse click denotes one press.
  const device = tokens.includes('keyboard') || tokens.includes('mouse');
  const specificGesture = ['typing','word','double','triple','pair','hold','release','up','spacebar','return','backspace','shortcut','command','chord'].some(term => tokens.includes(term));
  if (device && tokens.includes('click') && !specificGesture) tokens.splice(tokens.indexOf('click'), 1, 'single', 'press');
  let subject = [...new Set(tokens.filter(term => !isMood(term)))];
  // A foot planting on a named surface is a contact. The side and surface still matter.
  const foot = subject.some(t => ['foot','footstep','step','stride'].includes(t));
  if (foot && !subject.includes('slider')) {
    subject = [...new Set(subject.filter(t=>!['on','single','land'].includes(t)).map(t=>t==='foot'?'footstep':t))];
  }
  const isDevice = subject.some(t=>['mouse','trackpad','stylus','keyboard','laptop'].includes(t));
  if (isDevice) {
    if (subject.includes('laptop') && !subject.includes('keyboard')) subject.push('keyboard');
    if (subject.includes('release') || subject.includes('hold')) subject = subject.filter(t=>t!=='button');
    if (subject.includes('return') || subject.includes('spacebar')) subject = subject.filter(t=>!['press','hit','on'].includes(t));
  }
  const exactId = sounds.some(s => s.id === query.trim().toLowerCase());
  const catalogSearch = !exactId && sounds.some(s => s.id && s.kind !== 'design');
  // The game's genre describes the screen on which an interface appears. A named
  // object in the gesture itself (e.g. a portal opening) is still a source.
  const gameContext = /\s+(?:for|in|from)\s+(?:(?:a|an|the|my|our|this|sci-fi|fantasy|racing|jet|space|horror|fighting|mobile|browser)\s+)*(?:game|rpg)(?:\s+trailer)?\s*$/i;
  const actionWords = gameContext.test(query) ? words(query.replace(gameContext, '')) : undefined;
  const editorial = catalogSearch ? editorialBrief(actionWords ? subject.filter(t => actionWords.includes(t)) : subject) : undefined;
  // A delivery phrase describes the edit, even if the requested sound is a real-world source.
  const suffix = /\s+(?:for|in|under|during)\s+(?:(?:a|an|the|my|our|this|professional|clean|product|game|app|software|sci-fi|launch|screen|short|promotional)\s+)*(?:trailer|video|film|demo|teaser)\s*$/i;
  const sourceWords = catalogSearch && !editorial && suffix.test(query) ? words(query.replace(suffix, '')) : undefined;
  let terms = editorial?.terms ?? (sourceWords ? subject.filter(t => sourceWords.includes(t)) : subject.length ? subject : moods);
  if (!editorial && !exactId) {
    if(terms.includes('shield') && (terms.includes('block') || terms.includes('collapse'))) terms=terms.filter(t=>!['game','impact'].includes(t));
    if(terms.includes('canopy') && terms.includes('rain')) terms=terms.filter(t=>t!=='hit');
    if(terms.includes('hearth') && terms.includes('grate')) terms=terms.filter(t=>t!=='small');
  }
  const palette = mood === 'calm' ? ['calm', 'gentle', 'soft', 'distant', 'quiet'] :
    mood === 'dramatic' ? ['dramatic', 'surge', 'close', 'heavy', 'sharp'] : [];
  if (!terms.length) return [];
  // Direction and physical input are hard requirements for a picture-synced cue.
  const requirements = editorial?.action || isDevice ? terms.filter(term =>
    ['left','right','mouse','trackpad','stylus','on','off'].includes(term)) : [];
  const keyAction = isDevice && terms.includes('keyboard') && ['return','spacebar','backspace','shortcut'].find(action=>terms.includes(action));
  const pointerAction = !exactId && isDevice && (terms.includes('mouse') || terms.includes('trackpad') || terms.includes('stylus')) &&
    (terms.includes('hold') ? (terms.includes('release') ? 'press-and-hold' : 'press') : terms.includes('release') ? 'release' : null);
  if (pointerAction === 'press') terms = terms.map(term => term === 'hold' ? 'press' : term);
  if (pointerAction === 'press-and-hold') terms = terms.filter(term => term !== 'release');
  const vehicleTrailer = !editorial && terms.includes('trailer') && terms.some(t => ['truck','tractor','tow','hitch','coupling','axle','cargo','flatbed'].includes(t));
  const subjectNoun = terms.includes('portal') ? 'portal' : terms.includes('shield') && terms.includes('energy') ? 'shield' : undefined;
  const excluded = excludedTraits([...words(exclude), ...negated.filter(term => !isMood(term))]);
  const tactileNotice = editorial?.action === 'notice' && excluded.includes('chime');
  const validAction = sound => sound.editorialAction === editorial.action ||
    (tactileNotice && sound.id === 'menu-confirm-spring-detent');
  const documents = sounds.map(sound => {
    const aliases = (sound.soloQueries ?? []).map(q => words(q).filter(w => !stopWords.has(w)));
    const title = new Set([...words(sound.id + ' ' + sound.name), ...aliases.flat()]);
    const tags = new Set(words([...sound.tags,...(sound.fieldContents??[])].join(' ')));
    if (editorial?.action && validAction(sound)) {
      for (const term of editorialTerms(editorial.action)) tags.add(term);
    }
    const context = new Set(words([sound.category, sound.collection, sound.perspective, ...(sound.contains ?? [])].join(' ')));
    return { sound, title, tags, context, aliases };
  });
  const weights = terms.map(term => {
    const count = documents.filter(d => d.title.has(term) || d.tags.has(term) || d.context.has(term)).length;
    return 1 + Math.log((documents.length + 1) / (count + 1));
  });
  const floorStep = (terms.includes('step') || terms.includes('footstep')) &&
    (terms.includes('floor') || terms.includes('wood'));
  const scored = [];
  for (const { sound, title, tags, context, aliases } of documents) {
    if (editorial?.action && (!validAction(sound) || sound.cleanHold ||
        sound.auditionNote || sound.isolation !== 'isolated')) continue;
    if (!eligibleForIntent(sound,query)) continue;
    if (keyAction && !sound.id.endsWith('-'+keyAction) && !sound.id.includes('-'+keyAction+'-')) continue;
    if (pointerAction && !sound.id.endsWith('-'+pointerAction)) continue;
    if (vehicleTrailer && ![...title, ...tags].some(w => ['truck','tractor','tow','hitch','coupling','axle','cargo','flatbed'].includes(w))) continue;
    if (subjectNoun && !title.has(subjectNoun) && !tags.has(subjectNoun)) continue;
    if (requirements.some(t => !title.has(t) && !tags.has(t))) continue;
    if (floorStep) {
      const walking = title.has('footstep') || tags.has('footstep') || tags.has('walk');
      const material = terms.includes('wood') ? 'wood' : 'floor';
      const surface = title.has(material) || tags.has(material);
      if (!walking || !surface) continue;
    }
    // A broad catalog category can contain both tactile UI and fiction. Exclusions
    // describe the audible cue itself when choosing for a screen edit.
    if (excluded.some(word => title.has(word) || tags.has(word) || (!editorial && context.has(word)))) continue;
    let score = 0, hits = 0;
    terms.forEach((term, i) => {
      const relevance = title.has(term) ? 3 : tags.has(term) ? 2 : context.has(term) ? 1 : 0;
      score += relevance * weights[i];
      if (relevance) hits++;
    });
    const affinity = palette.filter(term => tags.has(term) || title.has(term)).length;
    if (!hits || !terms.some(t => title.has(t) || tags.has(t) || words((sound.contains ?? []).join(" ")).includes(t))) continue;
    const solo = aliases.some(a => a.length === terms.length && terms.every(t => a.includes(t)));
    const result = explain ? { ...sound, missing: terms.filter(t => !title.has(t) && !tags.has(t) && !context.has(t)) } : sound;
    const ballot = applicableVote(votes, sound, options.useCase ?? editorial?.action, spotted.context);
    if (options.respectVeto && rejectedVote(ballot)) continue;
    const familyFit = paletteAffinity(sound,options.palette);
    const surfaceStep = Number(foot && sound.id.startsWith('stride-') && terms.some(t=>sound.id.slice(7).split('-').includes(t)));
    const continuous = Number(!editorial && sound.loopable && terms.some(t=>['steady','cruise','hearth'].includes(t)));

    const vote = ballot?.decision;
    const preference = vote === 'no' || vote === 'rejected' ? -1 : vote === 'yes' || vote === 'approved' ? 1 : 0;
    const matchingProfile=options.signatures && editorial?.action && Object.entries(options.signatures).some(([slot,v])=>
      (slot===editorial.action || slot===('press/'+deviceKind(query))) && v.id===sound.id && v.revision===(sound.revision??1));
    const signature = Number(terms.some(t=>t==='sting' || t==='stinger') && title.has('signature'));
    const order = editorial ? listeningOrder(sound.id, query) : 0;
    const character = editorial ? subject.filter(t => ['quiet','soft','warm','crisp','gentle','minimal','energetic','energy'].includes(t) && (title.has(t) || tags.has(t))).length : 0;
    scored.push({ sound: result, matchingProfile:Boolean(matchingProfile), solo, surfaceStep, continuous, familyFit, signature, hits, preference, order, character, score: score * hits / terms.length * (1 + Math.min(2, affinity) * 0.10), exact: query.trim().toLowerCase() === sound.id });
  }
  if (spotted.context && editorial) {
    const familiar=scored.filter(x=>x.order<100 || /quiet-mouse-press|velvet-swipe|linen-match-cut/.test(x.sound.id));
    const order=contextOrder(familiar.map(x=>x.sound.id),spotted.context);
    for (const x of familiar) x.order=order.indexOf(x.sound.id);
  }
  return scored.sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.solo) - Number(a.solo) ||
    b.hits - a.hits || b.surfaceStep-a.surfaceStep || b.continuous-a.continuous || Number(a.preference < 0) - Number(b.preference < 0) || Number(b.matchingProfile)-Number(a.matchingProfile) || b.familyFit-a.familyFit || b.signature - a.signature || b.character - a.character ||
    (editorial ? a.order - b.order : 0) || b.score - a.score || b.preference - a.preference ||
    a.sound.id.localeCompare(b.sound.id)).map(item => mood ? { ...item.sound, suggestedMood: mood } : item.sound);
}

// A layer is one performance. Strip only instructions the renderer actually owns.
function worldRequest(query, layer) {
  let text = query.trim();
  if (Number.isFinite(layer.acoustics?.distanceM) && layer.acoustics.distanceM > 0)
    text = text.replace(/\b(?:distant|far[- ]away|far[- ]field)\b/gi, ' ');
  const single = /^(?:one|a single|single|1)\s+/i.test(text.trim());
  if (single) text = text.trim().replace(/^(?:one|a single|single|1)\s+/i, '');
  // A location after a vehicle performance sets the scene, not the engine type.
  if (/\b(?:taxi(?:ing)?|cruis(?:e|ing)|idling|driving)\b/i.test(text)) {
    text = text.replace(/\s+(?:on|at|along) (?:an? |the )?(?:airfield|apron|taxiway|highway|road|street)\s*$/i, '')
      .replace(/\bat (?:a )?(?:constant|steady|even) speed\b/gi, 'steady');
  }
  return {text: text.trim(), single};
}

// Ordinary editorial queries keep their press/word and family semantics. World-layer
// timing words may be satisfied by one isolated performance on the placement clock.
export function rankPerformance(bank, query, exclude, votes, options, layer = {}) {
  const exact = bank.find(s => s.id === query.trim().toLowerCase());
  if (exact) return rankByIntent([exact],query,exclude,true,votes,options);
  const editorial = /\b(?:key|keycap|keyboard|keypress|mouse|trackpad|button|menu|swipe|tab|logo|ui|transition)\b/i.test(query);
  const request = editorial ? {text:query, single:false} : worldRequest(query,layer);
  const ranked = rankByIntent(bank,request.text,exclude,true,votes,options);
  if (!request.single) return ranked;
  const gesture=/\b(?:strike|clap|crack|tap|knock|hit|step|splash|shot|snap|slam|ping|blast)\b/i.test(request.text);
  const compound=/\b(?:burst|double|triple|sequence|volley|series|pair)\b/i;
  return ranked.filter(sound =>
    (!gesture || !sound.loopable) &&
    (compound.test(request.text) || !compound.test(sound.id.replaceAll('-', ' '))));

}
