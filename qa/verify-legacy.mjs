import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderChannels } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';
import { composeListeningScene } from '../engine/listening-scene.ts';
import { headphoneFilter } from '../engine/headphones.ts';
import { placeAudio } from '../engine/spatial.ts';
const { masters } = JSON.parse(await readFile(new URL('./release-masters.json', import.meta.url)));
const { revisions } = JSON.parse(await readFile(new URL('./master-revisions.json', import.meta.url)));
for(const [id,r] of Object.entries(revisions)){
  if(r.previous!==masters[id] || r.current===r.previous || !/^[a-f0-9]{64}$/.test(r.current) || !r.reason)
    throw Error('Invalid master revision: '+id);
}
const { sounds } = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
if (Object.keys(masters).some(id => !sounds.some(sound => sound.id === id))) throw Error('Missing release recipe');
const mismatches = [];
const spatialFailures = [];
const energy = channel => channel.reduce((sum, sample) => sum + sample * sample, 0);
for (const {id} of sounds) {
  const expected = masters[id];
  const { default: recipe } = await import('../recipes/' + id + '.ts');
  const raw = renderChannels(recipe);
  const point = { kind: 'point', position: [1, 0, -1] };
  composeListeningScene({ schemaVersion: 2, id: 'position-check' }, [{ recipe, placement: point }]);
  // Exercise an audible portion even on a slow attack. Sending the same audio
  // through all three paths catches missing routing and accidental bypass.
  let loudest = 0;
  for (let i = 1; i < raw[0].length; i++)
    if (Math.abs(raw[0][i]) > Math.abs(raw[0][loudest])) loudest = i;
  const start = Math.max(0, Math.min(loudest - 1024, raw[0].length - 2048));
  const excerpt = raw.map(c => c.subarray(start, start + 2048));
  const listen = (output, x) => placeAudio(excerpt, {kind:'point', position:[x,0,0]},
    {position:[0,0,0]}, output, 44100, 0, output === 'headphones' ? headphoneFilter : undefined);
  const left = listen('headphones', -2), right = listen('headphones', 2);
  const near = listen('stereo', 2), far = listen('stereo', 20), mono = listen('mono', 2);
  const allChannels = [...left, ...right, ...near, ...far, ...mono];
  if (allChannels.some(c => !c.every(Number.isFinite)) || mono.length !== 1 ||
      energy(mono[0]) === 0 || energy(left[0]) <= energy(left[1]) ||
      energy(right[1]) <= energy(right[0]) || energy(far[1]) >= energy(near[1])) spatialFailures.push(id);
  const bytes = encodeWav(raw);
  const actual = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  if (expected && actual !== (revisions[id]?.current ?? expected)) mismatches.push(id);
}
console.log(JSON.stringify({ checked: Object.keys(masters).length, positioned:sounds.length, spatialFailures, intentionalRevisions:Object.keys(revisions).length, mismatches }));
process.exitCode = Number(mismatches.length > 0 || spatialFailures.length > 0);
