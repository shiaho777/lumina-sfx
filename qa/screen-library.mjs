// macOS release audit: swiftc -O qa/source-screen.swift -o /tmp/lumina-source-screen
// node --experimental-strip-types qa/screen-library.mjs /tmp/lumina-source-screen report.json [id ...]
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { renderChannels, SAMPLE_RATE } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';
const [binary, output, ...ids] = process.argv.slice(2);
if (!binary || !output) throw Error('Supply the compiled source-screen helper and an output JSON path');
const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
const { masters } = JSON.parse(await readFile(new URL('./release-masters.json', import.meta.url)));
const seed = Number(process.env.LUMINA_SCREEN_SEED ?? 104729);
if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Invalid screen seed');
const selected = ids.length ? ids : catalog.sounds.map((s) => s.id);
const temp = await mkdtemp(join(tmpdir(), 'lumina-screen-'));
const worker = spawn(resolve(binary), [], { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({ input: worker.stdout })[Symbol.asyncIterator]();
const rows = [];
try {
  for (const id of selected) {
    if (!/^[a-z0-9-]+$/.test(id)) throw Error('Invalid recipe id');
    const { default: recipe } = await import('../recipes/' + id + '.ts');
    const audio = renderChannels(recipe, { seed }),
      hash = createHash('sha256')
        .update(Buffer.from(encodeWav(audio)))
        .digest('hex');
    let peak = 0,
      windows = 0;
    const labels = {};
    for (const [side, channel] of audio.entries()) {
      for (const x of channel) {
        if (!Number.isFinite(x)) throw Error(id + ' produced a non-finite sample');
        peak = Math.max(peak, Math.abs(x));
      }
      // Pad short impacts with silence; classification of a short cue is only a review lead.
      const padded = new Float32Array(
        Math.max(channel.length + Math.round(0.49 * SAMPLE_RATE), (SAMPLE_RATE * 1.1) | 0),
      );
      padded.set(channel);
      const path = join(temp, 'probe.wav');
      await writeFile(path, Buffer.from(encodeWav(padded)));
      worker.stdin.write(path + '\n');
      const reply = await lines.next();
      if (reply.done) throw Error('SoundAnalysis stopped on ' + id);
      const estimate = JSON.parse(reply.value);
      if (estimate.error || !estimate.windows)
        throw Error(id + ': ' + (estimate.error ?? 'no analysis windows'));
      windows += estimate.windows;
      for (const [name, value] of Object.entries(estimate.labels))
        if (value.score > (labels[name]?.score ?? 0)) labels[name] = { ...value, side };
    }
    const intended = [recipe.id, ...recipe.tags, ...(recipe.contains ?? []), ...(recipe.components ?? [])].join(' ');
    const flags = [];
    for (const [name, { score, at }] of Object.entries(labels)) {
      const family = /speech|conversation|narration|chatter|talking|whisper|shout|singing|laughter/.test(
        name,
      )
        ? 'voice'
        : /typing|computer_keyboard|mouse_click|computer_mouse/.test(name)
          ? 'computer'
          : /cricket|insect|mosquito|bee_buzz|fly_buzz/.test(name) ? 'insect'
          : /bird|chirp|crow_caw|owl_hoot/.test(name)
            ? 'bird'
            : null;
      if (!family || score < 0.5) continue;
      if (
        family === 'computer' &&
        /typ(e|ing)|key(board|cap|stroke|press)|mouse|laptop|trackpad/.test(intended)
      )
        continue;
      if (
        (family === 'bird' && /bird|chicken|\bhen\b|rooster|duck|goose|geese|aviary|dawn chorus|\b(owl|crow|raven|robin|gull|sparrow|pigeon|eagle|falcon|hawk|parrot|finch)\b/.test(intended)) ||
        (family === 'insect' && /cricket|cicada|insect|mosquito|bee[- ]buzz|beehive|bees/.test(intended))
      ) continue;
      flags.push({ name, at, score: +score.toFixed(3) });
    }
    rows.push({
      id,
      hash,
      legacyMatch: seed !== 104729 || masters[id] === undefined ? null : masters[id] === hash,
      channels: audio.length,
      windows,
      peakDbfs: +(20 * Math.log10(Math.max(peak, 1e-12))).toFixed(2),
      flags,
      top: Object.entries(labels)
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 3)
        .map(([s, v]) => [s, +v.score.toFixed(2)]),
    });
    if (rows.length % 250 === 0) console.error('Screened ' + rows.length + ' / ' + selected.length);
  }
  await writeFile(
    join(temp, 'report.json'),
    JSON.stringify({ classifier: 'Apple SoundAnalysis version1', seed, rows }),
  );
  // Write adjacent to the destination so renaming also works across volumes.
  const next = output + '.' + process.pid + '.tmp';
  await writeFile(next, await readFile(join(temp, 'report.json')));
  await rename(next, output);
} finally {
  worker.stdin.end();
  worker.kill();
  await rm(temp, { recursive: true, force: true });
}
