// Render scored briefs for a listener who has access only to the WAVs and anonymous prompt sheet.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderChannels, SAMPLE_RATE } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';
import { loadDesign } from '../scripts/remix-design.mjs';

const [report, destination, profile] = process.argv.slice(2);
if (!report || !destination) throw Error('Supply the selection benchmark JSON and a new output directory');
if (profile && profile !== '--balanced') throw Error('Optional audition profile is --balanced');
const root = fileURLToPath(new URL('../', import.meta.url));
const rows = JSON.parse(await readFile(report, 'utf8'));
const { sounds } = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
const registered = new Set(sounds.map((sound) => sound.id));
const out = resolve(destination);
await mkdir(out); // Protect previous audition keys.
let shuffle = 193;
for (let i = rows.length - 1; i > 0; i--) {
  shuffle = (16807 * shuffle) % 2147483647;
  const j = shuffle % (i + 1);
  [rows[i], rows[j]] = [rows[j], rows[i]];
}
const key = [];
const rate = SAMPLE_RATE / 2;
for (let first = 0; first < rows.length; first += 8) {
  const chunk = rows.slice(first, first + 8);
  const tracks = Array.from({ length: 2 }, () => new Float32Array(chunk.length * 4 * rate));
  const reel = 'reel-' + String(first / 8 + 1).padStart(2, '0');
  for (const [slot, row] of chunk.entries()) {
    key.push({ reel, slot: slot + 1, ...row });
    if (!row.id) continue;
    if (!registered.has(row.id)) throw Error('Unknown selection ' + row.id);
    let { default: source } = await import('../recipes/' + row.id + '.ts');
    if (row.spatial?.file) {
      if (!/^references\/listening-scenes\/[a-z0-9-]+\.json$/.test(row.spatial.file))
        throw Error('Unknown spatial reference');
      source = (await loadDesign(join(root, row.spatial.file))).recipe;
    }
    if (row.spatial?.design) source = (await loadDesign(row.spatial.design)).recipe;
    const channels = renderChannels(source, { seed: 104729, level: profile ? 'balanced' : 'original' });
    const frames = Math.min(3.5 * rate, Math.floor(channels[0].length / 2));
    let peak = 0;
    for (const ch of channels) for (let i = 0; i < frames * 2; i++) peak = Math.max(peak, Math.abs(ch[i]));
    const gain = profile ? 1 : Math.min(4, 0.75 / (peak || 1));
    for (const [index, track] of tracks.entries()) {
      const ch = channels[index] ?? channels[0];
      for (let i = 0; i < frames; i++) {
        const fade = frames * 2 < ch.length ? Math.min(1, (frames - i) / 150) : 1;
        track[slot * 4 * rate + i] = (ch[2 * i] + ch[2 * i + 1]) * 0.5 * gain * fade;
      }
    }
  }
  await writeFile(join(out, reel + '.wav'), new Uint8Array(encodeWav(tracks, rate)));
  await writeFile(
    join(out, reel + '.txt'),
    chunk.map((row, i) => i * 4 + 's  ' + row.prompt).join('\n') + '\n',
  );
}
await writeFile(join(out, 'private-key.json'), JSON.stringify(key, null, 2) + '\n');
