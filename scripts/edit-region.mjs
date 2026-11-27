import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ffmpegPath } from './audio-export.mjs';

const run = promisify(execFile);
const width = 144, height = 20, frameSize = width * height;

// Register horizontal translation in the marked viewport. Compare the same
// central strip at every candidate offset, leaving room on both sides for travel.
function displacement(before, after) {
  const margin = 40;
  function difference(shift) {
    let error = 0;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = margin; x < width - margin; x++)
        error += Math.min(64, Math.abs(before[row + x] - after[row + x + shift]));
    }
    return error / ((width - 2 * margin) * height);
  }
  const stationary = difference(0);
  if (stationary < 0.6) return 0;
  let best = stationary, move = 0;
  for (let shift = -margin; shift <= margin; shift++) {
    const cost = difference(shift);
    if (cost < best) { best = cost; move = shift; }
  }
  if (move === 0 && stationary < 7) return 0;
  if (best > 11 || (stationary > 3 && best > stationary * 0.72)) return null;
  return best < stationary * 0.82 ? move : 0;
}

async function sampleRegion(file, event, fps, duration) {
  const r = event.travelRegion, first = event.frame, end = event.endFrame;
  if (!r || !['x','y','width','height'].every(k => Number.isSafeInteger(r[k])) ||
      r.x < 0 || r.y < 0 || r.width < 8 || r.height < 4)
    throw Error('Use a picture-space crop {x,y,width,height} on ' + event.id);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(end) || first < 0 ||
      end > duration || end - first < 2) throw Error('Mark the visible slide interval for ' + event.id);
  if (end - first > 2048) return undefined; // A long camera take can supply its own sparse element positions.
  const frames = end - first + 1;
  const crop = "crop=w='if(lte(" + (r.x+r.width) + ",iw)," + r.width + ",0)':h='if(lte(" +
    (r.y+r.height) + ",ih)," + r.height + ",0)':x=" + r.x + ':y=' + r.y + ':exact=1';
  const filters = ['setpts=PTS-STARTPTS', 'fps=' + fps, 'trim=start_frame=' + first +
    ':end_frame=' + (end + 1), 'format=gray', crop, 'scale=' + width + ':' + height + ':flags=area'];
  const { stdout } = await run(ffmpegPath(), ['-v','error','-nostdin','-i',file,'-map','0:v:0','-an',
    '-vf',filters.join(','),'-frames:v',String(frames),'-f','rawvideo','-pix_fmt','gray','pipe:1'],
    { encoding:'buffer', maxBuffer: frames * frameSize + 65536 });
  const count = stdout.length / frameSize;
  // At a final exclusive edit boundary the last picture is one frame before end.
  if (count !== frames && !(end === duration && count === frames-1)) return undefined;
  const path = [{ frame:first, x:0 }];
  let x = 0;
  for (let i = 1; i < count; i++) {
    const step = displacement(stdout.subarray((i-1)*frameSize,i*frameSize),stdout.subarray(i*frameSize,(i+1)*frameSize));
    if (step === null) return undefined;
    x += step;
    path.push({ frame:first+i, x });
  }
  if (count < frames) path.push({ frame:end, x });
  return path;
}

export async function withPictureTravel(input, file, fps, duration) {
  if (!file || !input.events?.some(e => e.travelRegion && !e.travel)) return input;
  const events = [];
  for (const event of input.events) {
    const audible = !event.muted && (event.accent || event.motion === 'follow' || event.soundId);
    if (!audible || !event.travelRegion || event.travel) { events.push(event); continue; }
    const travel = await sampleRegion(file, event, fps, duration);
    events.push(travel ? { ...event, travel } : event);
  }
  return { ...input, events };
}
