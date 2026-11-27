// Audio delivery uses the exact master that passed QA. Keep compressed delivery optional.
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { link, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function publishAudioProject(directory, id, build) {
  const destination = resolve(directory);
  const project = join(destination, id);
  await mkdir(destination, { recursive: true });
  const stage = await mkdtemp(join(destination, '.lumina-audio-'));
  try {
    const write = (file, bytes) => {
      writeFileSync(join(stage, file), bytes);
      return { file, sha256: digest(bytes) };
    };
    const assets = await build(write);
    try {
      await rename(stage, project);
    } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY', 'ENOTDIR', 'EISDIR'].includes(error.code)) throw error;
      const expected = (await readdir(stage)).sort();
      let existing;
      try {
        existing = (await readdir(project)).sort();
      } catch (statError) {
        if (statError.code !== 'ENOTDIR') throw statError;
      }
      const conflict = () => Error('Project already exists with different files: ' + project);
      if (!existing || existing.length !== expected.length || expected.some((name, i) => name !== existing[i])) throw conflict();
      for (const name of expected) {
        if (digest(await readFile(join(stage, name))) !== digest(await readFile(join(project, name)))) throw conflict();
      }
    }
    return { project, assets };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export async function publishAsset(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const stage = await mkdtemp(join(dirname(path), '.lumina-'));
  const staged = join(stage, basename(path));
  try {
    await writeFile(staged, bytes);
    try {
      await link(staged, path);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!(await readFile(path)).equals(Buffer.from(bytes))) throw Error('File has local changes: ' + path);
    }
    if (digest(await readFile(path)) !== digest(bytes)) throw Error('File verification failed: ' + path);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export function ffmpegPath() {
  const local = join(homedir(), '.local/share/lumina-sfx/tools/ffmpeg');
  return process.env.FFMPEG_PATH || (existsSync(local) ? local : 'ffmpeg');
}
export async function encodeDelivery(wav, format) {
  if (format === 'wav') return wav;
  if (!['opus', 'ogg'].includes(format)) throw Error('Unknown audio format: ' + format);
  const ffmpeg = ffmpegPath();
  const temp = await mkdtemp(join(tmpdir(), 'lumina-encode-'));
  try {
    const source = join(temp, 'master.wav'), output = join(temp, 'delivery.' + format);
    const channels = wav.readUInt16LE(22), rate = wav.readUInt32LE(24);
    const frames = wav.readUInt32LE(40) / wav.readUInt16LE(32);
    await writeFile(source, wav);
    const codec = format === 'ogg' ? ['-c:a', 'libvorbis', '-q:a', '6'] : ['-c:a', 'libopus', '-b:a', channels === 2 ? '128k' : '80k'];
    for (const trimDb of [1.5, 3, 6]) {
      await run(ffmpeg, ['-nostdin', '-v', 'error', '-y', '-i', source, '-map_metadata', '-1', '-af', 'volume=-' + trimDb + 'dB', ...codec,
        '-fflags', '+bitexact', '-flags:a', '+bitexact', output]);
      const { stdout } = await run(ffmpeg, ['-v','error','-i',output,'-ar',String(rate),'-f','f32le','pipe:1'],
        { encoding: 'buffer', maxBuffer: (frames + 8192) * channels * 4 });
      // Vorbis encoders can pad/trim a transform block; Opus signals its exact end.
      const tolerance = format === 'opus' ? 2 : 256;
      if (Math.abs(stdout.length / (4 * channels) - frames) > tolerance) throw Error('Decoded duration differs from master');
      let peak = 0;
      for (let i = 0; i < stdout.length; i += 4) peak = Math.max(peak, Math.abs(stdout.readFloatLE(i)));
      if (peak > 0 && peak <= 10 ** (-0.5/20)) return await readFile(output);
    }
    throw Error('Lossy delivery exceeds peak ceiling after decoding');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
