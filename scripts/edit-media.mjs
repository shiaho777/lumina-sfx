import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, link, rm, open, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { ffmpegPath, publishAsset } from './audio-export.mjs';

const run = promisify(execFile);
async function ff(args) {
  try {
    return await run(ffmpegPath(), ['-hide_banner', '-nostdin', ...args], { maxBuffer: 8 * 1024 * 1024 });
  } catch (e) {
    throw Error(
      e.code === 'ENOENT'
        ? 'Install FFmpeg or set FFMPEG_PATH to inspect or mix picture.'
        : String(e.stderr || e.message).slice(-2000),
    );
  }
}
export async function mediaInfo(file, video) {
  const { stderr } = await ff([
    '-i',
    resolve(file),
    '-map',
    video ? '0:v:0' : '0:a:0',
    '-c',
    'copy',
    '-t',
    '0',
    '-f',
    'null',
    '-',
  ]);
  const head = stderr.split('Stream mapping:')[0],
    duration = head.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!duration) throw Error('Could not read finite media duration');
  const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  const frameRate = Number(head.match(/Video:[^\n]*?([\d.]+) fps/)?.[1]);
  const audioStreams = (head.match(/Stream #0:\d+[^\n]*?: Audio:/g) || []).length;
  return { seconds, nominalFps: frameRate || null, audioStreams };
}
export async function inspectPicture(file, out) {
  const info = await mediaInfo(file, true),
    dest = resolve(out);
  await mkdir(dirname(dest), { recursive: true });
  try {
    await stat(dest);
    throw Error('Choose a new inspection directory');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const stage = await mkdtemp(join(dirname(dest), '.lumina-picture-'));
  try {
    const n = Math.min(24, Math.max(1, Math.ceil(info.seconds * 2))),
      interval = info.seconds / n;
    // Address the original presentation clock. This preserves irregular frame timing in screen recordings.
    const vf =
      'setpts=PTS-STARTPTS,select=if(isnan(prev_selected_t)\\,1\\,gte(t-prev_selected_t\\,' +
      Math.max(0.001, interval - 0.012) +
      ')),showinfo,scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,tile=4x' +
      Math.ceil(n / 4);
    const { stderr } = await ff([
      '-i',
      resolve(file),
      '-an',
      '-vf',
      vf,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      join(stage, 'storyboard.jpg'),
    ]);
    const frameTimes = Array.from(
      stderr.matchAll(/\bn:\s*\d+\s+pts:\s*-?\d+\s+pts_time:\s*([\d.e+-]+)/g),
      (m) => Number(m[1]),
    ).slice(0, 4 * Math.ceil(n / 4));
    if (!frameTimes.length) throw Error('No picture frames were inspected');
    if (info.audioStreams)
      await ff([
        '-v',
        'error',
        '-i',
        resolve(file),
        '-map',
        '0:a:0',
        '-vn',
        '-ac',
        '2',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        join(stage, 'original-audio.m4a'),
      ]);
    const report = {
      ...info,
      frameTimes,
      storyboard: 'storyboard.jpg',
      originalAudio: info.audioStreams ? 'original-audio.m4a' : null,
    };
    await writeFile(join(stage, 'picture.json'), JSON.stringify(report, null, 2) + '\n');
    await rename(stage, dest);
    return report;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
// Preserve the original sample even at a full-level accent. Use one gain for both
// sides of the added stem and recover over 20 ms to preserve its stereo image.
function originalFirstMix(stream, conform) {
  const stereo = 'aresample=48000:async=1:first_pts=0,aformat=sample_fmts=fltp:channel_layouts=stereo';
  const room = (original, added) =>
    `if(gt(abs(${added}),0.000001),max(0,0.97-${original}*sgn(${added}))/abs(${added}),1)`;
  const gain = `min(1,min(${room('val(0)', 'val(2)')},${room('val(1)', 'val(3)')}))`;
  const smooth = `st(0,min(${gain},if(eq(n,0),1,1-(1-ld(0))*exp(-1/960))))`;
  const channel = (i) => `val(${i})+val(${2 + i})*${smooth}`;
  return [
    `[0:a:${stream}]${stereo},apad[original]`,
    `[1:a:0]${stereo}${conform ? ',' + conform : ''}[stem]`,
    `[original][stem]amerge=inputs=2,aeval=exprs='${channel(0)}|${channel(1)}':c=stereo,pan=stereo|c0=c0|c1=c1[mix]`,
  ].join(';');
}

// The editor writes canonical 16-bit PCM. Inspect exact sample bytes, so a very
// quiet authored effect can never be mistaken for an instruction to keep the original.
async function silentEditorStem(file) {
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(44);
    if ((await handle.read(header)).bytesRead !== 44 || header.toString('ascii', 0, 4) !== 'RIFF' ||
        header.toString('ascii', 8, 16) !== 'WAVEfmt ' || header.readUInt32LE(16) !== 16 ||
        header.readUInt16LE(20) !== 1 || header.readUInt16LE(34) !== 16 ||
        header.toString('ascii', 36, 40) !== 'data') return false;
    const size = (await handle.stat()).size, dataBytes = header.readUInt32LE(40);
    if (!dataBytes || dataBytes + 44 !== size || header.readUInt32LE(4) + 8 !== size) return false;
    const data = Buffer.alloc(65536), zero = Buffer.alloc(data.length);
    let remaining = dataBytes;
    while (remaining > 0) {
      const {bytesRead} = await handle.read(data, 0, Math.min(remaining, data.length));
      if (!bytesRead || data.compare(zero, 0, bytesRead, 0, bytesRead) !== 0) return false;
      remaining -= bytesRead;
    }
    return true;
  } finally { await handle.close(); }
}

async function deliveryLevel(file) {
  const { stdout, stderr } = await ff([
    '-progress', 'pipe:1',
    '-i',
    file,
    '-map',
    '0:a:0',
    '-vn',
    '-af',
    'ebur128=peak=true:framelog=verbose',
    '-f',
    'null',
    '-',
  ]);
  const result = stderr.match(/True peak:\s*Peak:\s*(-inf|[-+\d.]+)\s*dBFS/i);
  if (!result) throw Error('Could not measure true peak of the encoded soundtrack');
  const time = [...stdout.matchAll(/^out_time_us=(\d+)$/gm)].at(-1)?.[1];
  return {peak: result[1] === '-inf' ? -Infinity : Number(result[1]), seconds: Number(time) / 1e6};
}
export async function mixPicture(file, stem, out, audioStream = 0, fitPicture = false) {
  const [picture, audio] = await Promise.all([mediaInfo(file, true), mediaInfo(stem, false)]);
  if (
    !fitPicture &&
    Math.abs(picture.seconds - audio.seconds) > Math.max(0.055, 1.1 / (picture.nominalFps || 24))
  )
    throw Error('Stem and picture duration differ. Check the project frame rate.');
  if (
    !Number.isSafeInteger(audioStream) ||
    audioStream < 0 ||
    audioStream >= Math.max(1, picture.audioStreams)
  )
    throw Error('Unknown original audio stream');
  const dest = resolve(out);
  await mkdir(dirname(dest), { recursive: true });
  const stage = await mkdtemp(join(dirname(dest), '.lumina-mix-')),
    video = join(stage, 'preview.mp4');
  try {
    if (picture.audioStreams && await silentEditorStem(stem)) {
      let copied = true;
      try {
        await ff(['-v','error','-i',resolve(file),'-map','0:v:0','-map','0:a:' + audioStream,
          '-c','copy','-movflags','+faststart',video]);
      } catch (error) {
        if (!/codec .*not currently supported|Could not find tag|incompatible with output codec/i.test(error.message)) throw error;
        copied = false;
      }
      if (copied) {
        const {peak, seconds} = await deliveryLevel(video);
        if (peak <= -0.5 && Math.abs(seconds - picture.seconds) <= 0.055) {
          await link(video, dest);
          return { file: dest, pictureEncoding: 'copy', audioEncoding: 'copy', truePeakDbtp: Number.isFinite(peak) ? peak : null,
            deliveryTrimDb: 0, ...(fitPicture ? {fittedStemSeconds: audio.seconds} : {}),
            originalTracks: picture.audioStreams, usedAudioStream: audioStream, seconds: picture.seconds };
        }
      }
      await rm(video, {force: true});
    }
    let deliveryTrimDb = 0;
    const conform = fitPicture
      ? 'atrim=end=' +
        picture.seconds +
        (audio.seconds > picture.seconds
          ? ',afade=t=out:st=' + Math.max(0, picture.seconds - 0.035) + ':d=0.035'
          : '') +
        ',apad,atrim=end=' +
        picture.seconds
      : '';
    const encode = (codec) => {
      const args = ['-v', 'error', '-i', resolve(file), '-i', resolve(stem), '-map', '0:v:0'];
      let chain = picture.audioStreams ? originalFirstMix(audioStream, conform) : '';
      if (!chain && conform) chain = '[1:a:0]' + conform + '[mix]';
      if (chain) {
        const output = deliveryTrimDb ? '[delivered]' : '[mix]';
        if (deliveryTrimDb) chain += ';[mix]volume=' + deliveryTrimDb + 'dB[delivered]';
        args.push('-filter_complex', chain, '-map', output);
      } else {
        args.push('-map', '1:a:0');
        if (deliveryTrimDb) args.push('-af', 'volume=' + deliveryTrimDb + 'dB');
      }
      return ff([
        ...args,
        '-t',
        String(picture.seconds),
        ...codec,
        '-c:a',
        'aac',
        '-b:a',
        '256k',
        '-movflags',
        '+faststart',
        video,
      ]);
    };
    let pictureEncoding = 'copy';
    try {
      await encode(['-c:v', 'copy']);
    } catch (error) {
      if (
        !/codec .*not currently supported|Could not find tag|incompatible with output codec/i.test(
          error.message,
        )
      )
        throw error;
      await rm(video, { force: true });
      await encode(['-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p']);
      pictureEncoding = 'h264';
    }
    let truePeakDbtp = (await deliveryLevel(video)).peak;
    // AAC can overshoot on a recording that was already hot. Make one static edit to
    // the delivery copy only, then measure the actual encode again before publishing.
    for (let attempt = 0; truePeakDbtp > -0.5 && attempt < 3; attempt++) {
      deliveryTrimDb = Number((deliveryTrimDb - (truePeakDbtp + 0.8)).toFixed(2));
      await rm(video);
      await encode(
        pictureEncoding === 'copy'
          ? ['-c:v', 'copy']
          : ['-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p'],
      );
      truePeakDbtp = (await deliveryLevel(video)).peak;
    }
    if (truePeakDbtp > -0.5)
      throw Error('Encoded picture exceeds the true-peak ceiling after three delivery trims');
    await link(video, dest);
    return {
      file: dest,
      pictureEncoding,
      truePeakDbtp: Number.isFinite(truePeakDbtp) ? truePeakDbtp : null,
      deliveryTrimDb,
      ...(fitPicture ? { fittedStemSeconds: audio.seconds } : {}),
      originalTracks: picture.audioStreams,
      usedAudioStream: picture.audioStreams ? audioStream : null,
      seconds: picture.seconds,
    };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

// One picture and a common transport, so an A/B switch never moves the viewer to another beat.
export async function comparePictures(a, b, out, c, ballot, transport = {}) {
  const files = [a, b, ...(c ? [c] : [])];
  const [first, ...others] = await Promise.all(files.map((f) => mediaInfo(f, true)));
  if (others.some((x) => Math.abs(first.seconds - x.seconds) > 0.055))
    throw Error('Compare two mixes of the same cut and duration');
  const local = (file) =>
    relative(dirname(resolve(out)), resolve(file))
      .split(sep)
      .map((s) => encodeURIComponent(s))
      .join('/');

  const template = await readFile(new URL('../references/edit-comparison.html', import.meta.url), 'utf8');
  await publishAsset(
    resolve(out),
    Buffer.from(
      template
        .replace('<!--TRANSPORT-->', JSON.stringify(transport).replaceAll('<', '\\u003c'))
        .replace('<!--BALLOT-->', JSON.stringify(ballot ?? null).replaceAll('<', '\\u003c'))
        .replace('<!--MIXES-->', JSON.stringify(files.map(local)).replaceAll('<', '\\u003c')),
    ),
  );
  return { file: resolve(out), duration: first.seconds };
}
