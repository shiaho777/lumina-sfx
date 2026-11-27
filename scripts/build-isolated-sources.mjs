// Run with Node's TypeScript support. All inputs are checked-in CC0 takes.
// A stationary spectrum retains engine coloration while discarding the time sequence.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyIntactTakes } from './install-files.mjs';
import { fft, stationaryTexture } from './recording-texture.mjs';
const folder = new URL('../recipes/_recordings/', import.meta.url);
function transient(take, sampleRate) {
  const pcm = Buffer.from(take, 'base64'),
    frames = pcm.length / 2;
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)));
  let start = 0;
  while (start < frames && Math.abs(pcm.readInt16LE(start * 2)) < peak * 0.17) start++;
  start = Math.max(0, start - Math.round(0.0005 * sampleRate));
  const length = Math.min(frames - start, Math.round(0.034 * sampleRate));
  const result = Buffer.alloc(length * 2);
  for (let i = 0; i < length; i++)
    result.writeInt16LE(
      Math.round(
        pcm.readInt16LE((start + i) * 2) *
          Math.min(1, i / (sampleRate * 0.0003), (length - 1 - i) / (sampleRate * 0.004)),
      ),
      i * 2,
    );
  return result.toString('base64');
}
const inputs = JSON.parse(await readFile(new URL('../sources/isolated-inputs.json', import.meta.url), 'utf8'));
const check = process.argv.includes('--check');
await verifyIntactTakes(inputs.intactTakes ?? []);
// Complete field gestures and longer ambience excerpts are packed once. Keep their
// source offsets and digests so offline builds check the exact selected takes.
for (const [name, cuts] of Object.entries(inputs.fieldTakes)) {
  const { default: clip } = await import(new URL('isolated-' + name + '.ts', folder));
  if (clip.takes.length !== cuts.length || clip.credit.license !== 'CC0-1.0')
    throw Error('Unexpected field recording: ' + name);
  for (const [i, cut] of cuts.entries()) {
    const pcm = Buffer.from(clip.takes[i], 'base64');
    if (pcm.length !== 2 * cut.frames || createHash('sha256').update(pcm).digest('hex') !== cut.sha256)
      throw Error('Field take mismatch: ' + name + '/' + i);
  }
}
function windowTake(clip, [take, start, seconds], matchStrike) {
  const pcm = Buffer.from(clip.takes[take], 'base64');
  const offset = Math.round(start * clip.sampleRate);
  const frames = Math.round(seconds * clip.sampleRate);
  if (offset < 0 || frames < 2 || 2*(offset+frames) > pcm.length) throw Error('Window outside recording');
  let lead = 0, gain = 1;
  if (matchStrike) {
    let peak = 0;
    for (let i=0; i<frames; i++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(2*(offset+i))));
    while (lead < frames-1 && Math.abs(pcm.readInt16LE(2*(offset+lead))) < .12*peak) lead++;
    lead = Math.max(0, lead - Math.round(.00035*clip.sampleRate));
    const active = Math.min(frames - lead, Math.round(.025*clip.sampleRate));
    let energy = 0;
    for (let i=0; i<active; i++) energy += (pcm.readInt16LE(2*(offset+lead+i))/32768)**2;
    gain = Math.min(5, .11/Math.max(.003, Math.sqrt(energy/active)));
  }
  const out = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames-lead; i++) {
    const edge = Math.min(1, i / (.0004 * clip.sampleRate), (frames-lead-1-i) / (.006 * clip.sampleRate));
    const value = pcm.readInt16LE(2*(i+offset+lead))/32768;
    const shaped = matchStrike ? .82*Math.tanh(gain*value/.82) : value;
    out.writeInt16LE(Math.round(32768*shaped*edge), 2*i);
  }
  return out.toString('base64');
}
// Short-time spectral subtraction against quiet rain in the same field recording.
// Overlap-add preserves the strike envelope and avoids an audible gate opening.
function subtractFloor(take, floor, rate) {
  const n=512, hop=n/4, raw=Buffer.from(take,'base64'), count=raw.length/2;
  const win=Float64Array.from({length:n},(_,i)=>Math.sin(Math.PI*(i+.5)/n));
  const reference=Buffer.from(floor.clip.takes[floor.take],'base64');
  const floorHop=rate/floor.clip.sampleRate;
  const bins=Array.from({length:n},()=>[]);
  function frame(sample){
    const re=win.map((w,i)=>w*sample(i)),im=new Float64Array(n);
    fft(re,im);return [re,im];
  }
  for(let pos=0;pos+n<floor.duration*rate;pos+=hop){
    const [re,im]=frame(i=>reference.readInt16LE(2*Math.floor(floor.start*floor.clip.sampleRate+(pos+i)/floorHop)));
    re.forEach((v,k)=>bins[k].push(v*v+im[k]*im[k]));
  }
  if(!bins[0].length)throw Error('Too little noise reference');
  const noise=bins.map(xs=>xs.sort((a,b)=>a-b)[xs.length>>1]);
  const out=new Float64Array(count),weights=new Float64Array(count);
  for(let pos=-n+hop;pos<count;pos+=hop){
    const [re,im]=frame(i=>pos+i<0||pos+i>=count?0:raw.readInt16LE(2*(pos+i)));
    for(let k=0;k<n;k++){
      const g=Math.sqrt(Math.max(.015,1-2.2*noise[k]/Math.max(1,re[k]**2+im[k]**2)));
      re[k]*=g;im[k]*=g;
    }
    fft(re,im,true);
    for(let i=0;i<n;i++)if(pos+i>=0 && pos+i<count){out[pos+i]+=re[i]*win[i]/n;weights[pos+i]+=win[i]**2;}
  }
  for(let i=0;i<count;i++)raw.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(out[i]/weights[i]))),2*i);
  return raw.toString('base64');
}
for (const name of [...inputs.stationaryTexture, ...inputs.transient, ...Object.keys(inputs.windows)]) {
  const window = inputs.windows[name];
  const { default: clip } = await import(new URL((window?.source ?? name) + '.ts', folder));
  const transform = inputs.stationaryTexture.includes(name) ? stationaryTexture : transient;
  let takes = window ? window.cuts.map(cut => windowTake(clip, cut, window.matchStrike)) : clip.takes.map((t) => transform(t, clip.sampleRate));
  if(window?.noiseFloor){
    const floor=window.noiseFloor;
    const {default:noiseClip}=await import(new URL(floor.source+'.ts',folder));
    takes=takes.map(t=>subtractFloor(t,{...floor,clip:noiseClip},clip.sampleRate));
  }
  if (window?.extendSec !== undefined) {
    // Reconstruct a continuous rail friction bed from the two identified turns
    // on the track. Crossfade their tails and alternate the starting take.
    const frames = Math.round(clip.sampleRate * window.extendSec);
    const overlap = Math.round(.105 * clip.sampleRate);
    const pieces = takes.map(t => Buffer.from(t, 'base64'));
    if (!Number.isSafeInteger(frames) || frames < 1 || pieces.some(b => b.length / 2 < 2 * overlap))
      throw Error('Unusable sustain window: ' + name);
    takes = pieces.map((_, first) => {
      const data = new Float32Array(frames);
      for (let at = 0, n = first; at < frames; n++) {
        const part = pieces[n % pieces.length], count = part.length / 2;
        for (let i = 0; i < count && at + i < frames; i++) {
          const w = Math.min(1, at ? i / overlap : 1, (count - 1 - i) / overlap);
          data[at + i] += w * part.readInt16LE(i * 2);
        }
        at += count - overlap;
      }
      const bytes = Buffer.alloc(2 * frames);
      data.forEach((v,i) => bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), 2*i));
      return bytes.toString('base64');
    });
  }
  const text =
    "// Derived offline by scripts/build-isolated-sources.mjs\nimport type { RecordedClip } from '../../engine/recording.ts';\nexport default " +
    JSON.stringify({ credit: clip.credit, sampleRate: clip.sampleRate, takes }, null, 2) +
    ' satisfies RecordedClip;\n';
  const file = new URL('isolated-' + name + '.ts', folder);
  if (check) {
    if ((await readFile(file, 'utf8')) !== text) throw Error('Isolation transform mismatch: ' + name);
  } else await writeFile(file, text);
}
