const { reel, ...data } = JSON.parse(document.querySelector('#audio-data').textContent);
const key = 'lumina-scene-' + reel;
const el = (id) => document.getElementById(id);
let ctx,
  generation = 0,
  voices = [],
  index = 0,
  auditioned = false;
const cache = new Map();
let votes = {};
try {
  votes = JSON.parse(localStorage.getItem(key) || '{}') || {};
} catch {}
el('bed').checked = Boolean(data.bed && !data.startDry);
if(!data.bed)el('bed').closest('label').hidden=true;
if (data.musicDesk) el('repeat').hidden = true;
const choices = data.choices.slice();
for (let i = choices.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [choices[i], choices[j]] = [choices[j], choices[i]];
}
function show() {
  const done = index === choices.length;
  el('count').textContent = done ? 'Review complete.' : 'Candidate ' + (index + 1) + ' of ' + choices.length;
  for (const id of ['yes', 'no', 'play', 'repeat']) el(id).disabled = done;
  if(!done) el('repeat').textContent = choices[index].takes.length===1 ? 'Replay this take' : 'Play ten takes';
  el('heard').value = '';
  el('reason').value = '';
  auditioned = false;
}
function stop() {
  generation++;
  for (const voice of voices) {
    try {
      voice.stop();
    } catch {}
  }
  voices = [];
}
async function buffer(bytes) {
  if (!cache.has(bytes)) {
    const raw = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0));
    cache.set(bytes, ctx.decodeAudioData(raw.buffer));
  }
  return cache.get(bytes);
}
async function play(many = false) {
  stop();
  const serial = generation;
  try {
    if (index >= choices.length) return;
    ctx ??= new AudioContext();
    await ctx.resume();
    const item = choices[index];
    const bed = data.bed && el('bed').checked ? await buffer(data.bed) : null;
    const sounds = await Promise.all((many ? item.takes : item.takes.slice(0, 1)).map(buffer));
    if (serial !== generation) return;
    let out = ctx.destination;
    const nodes = [];
    if (el('phone').checked) {
      const low = ctx.createBiquadFilter(),
        high = ctx.createBiquadFilter();
      low.type = 'highpass';
      low.frequency.value = 420;
      high.type = 'lowpass';
      high.frequency.value = 3900;
      low.channelCount = 1;
      low.channelCountMode = 'explicit';
      low.connect(high).connect(out);
      out = low;
      nodes.push(low, high);
    }
    const when = ctx.currentTime + 0.025;
    let at = when + (bed ? 0.12 : 0);
    const sources = [];
    function source(b, loop, time) {
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.loop = loop;
      s.connect(out);
      s.start(time);
      voices.push(s);
      sources.push(s);
      return s;
    }
    const ambient = bed ? source(bed, true, when) : null;
    for (const b of sounds) {
      source(b, false, at);
      at += b.duration + 0.16;
    }
    if (ambient) ambient.stop(at);
    let pending = sources.length;
    for (const s of sources)
      s.onended = () => {
        s.disconnect();
        if (!--pending) nodes.forEach((n) => n.disconnect());
      };
    auditioned = true;
    el('status').textContent = many && sounds.length>1 ? 'Playing '+sounds.length+' takes.' : 'Playing.';
  } catch (e) {
    el('status').textContent = e.message;
  }
}
function vote(decision) {
  if (!auditioned || index >= choices.length) {
    el('status').textContent = 'Play the candidate first.';
    return;
  }
  const item = choices[index];
  votes[item.id] = {
    decision, revision: item.revision, useCase:data.useCase, context:data.context,
    heard: el('heard').value,
    reason: el('reason').value,
    background: el('bed').checked,
    phone: el('phone').checked,
  };
  try {
    localStorage.setItem(key, JSON.stringify(votes));
  } catch {}
  stop();
  index++;
  show();
  el('status').textContent = 'Vote saved for this session.';
  if (index < choices.length) play();
}
el('play').onclick = () => play();
el('repeat').onclick = () => play(true);
el('stop').onclick = stop;
el('yes').onclick = () => vote('yes');
el('no').onclick = () => vote('no');
el('phone').onchange = el('bed').onchange = () => play();
el('reset').onclick = () => {
  stop();
  index = 0;
  show();
  play();
};
el('save').onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ reel, bed: data.bedId, votes }, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lumina-listening-' + reel + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.onkeydown = (e) => {
  if (e.repeat || e.metaKey || e.altKey || e.ctrlKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName))
    return;
  if (e.key === ' ') {
    e.preventDefault();
    play();
  }
  if (e.key.toLowerCase() === 'y') vote('yes');
  if (e.key.toLowerCase() === 'n') vote('no');
};
show();
