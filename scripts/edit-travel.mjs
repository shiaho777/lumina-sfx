// Screen x increases to the right. Timing belongs to the element doing the moving.
export function observedSlide(event) {
  if (event.travel === undefined && event.travelRegion === undefined) return event;
  if (event.action !== 'slide') throw Error('Supply horizontal travel on a slide: ' + event.id);
  const { travel, ...cue } = event;
  const first = cue.frame, last = cue.endFrame;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last - first < 2)
    throw Error('Mark the start and end frames of ' + cue.id);
  if (travel === undefined) {
    if (cue.syncFrame !== undefined && cue.direction) return cue;
    return { ...cue, motionReview: 'Inspect the moving region or supply the element travel.' };
  }
  if (!Array.isArray(travel) || travel.length < 2 || travel[0]?.frame !== first || travel.at(-1)?.frame !== last)
    throw Error('Travel samples must cover both slide bounds: ' + cue.id);

  const intervals = [];
  let distance = 0;
  for (let i = 0; i < travel.length; i++) {
    const point = travel[i];
    if (!Number.isSafeInteger(point?.frame) || !Number.isFinite(point.x) || (i && point.frame <= travel[i-1].frame))
      throw Error('Use increasing frame numbers and finite x positions: ' + cue.id);
    if (!i) continue;
    const previous = travel[i-1], dx = point.x - previous.x;
    intervals.push({ from: previous.frame, to: point.frame, speed: Math.abs(dx) / (point.frame - previous.frame) });
    distance += Math.abs(dx);
  }
  const net = travel.at(-1).x - travel[0].x;
  if (distance === 0 || Math.abs(net) < 0.85 * distance)
    return { ...cue, motionReview: 'Mark a single moving leg; split the gesture at a reversal.' };
  // A constant-speed segment has no unique apex. Center its first contiguous fastest run.
  const peak = intervals.reduce((max, step) => Math.max(max, step.speed), 0);
  const index = intervals.findIndex(step => step.speed === peak);
  let a = index, b = index;
  while (a > 0 && intervals[a-1].speed >= peak * 0.985) a--;
  while (b + 1 < intervals.length && intervals[b+1].speed >= peak * 0.985) b++;
  const frame = Math.round((intervals[a].from + intervals[b].to) / 2);
  const direction = net > 0 ? 'right' : 'left';
  if (cue.direction && cue.direction !== direction)
    return { ...cue, motionReview: 'The marked direction disagrees with the moving element.' };
  return {
    ...cue, direction,
    screenPath: travel.map(p => [(p.frame-first)/(last-first), Math.min(1, Math.max(0, (p.x-travel[0].x)/net))]),
    syncFrame: cue.syncFrame ?? Math.max(first + 1, Math.min(last - 1, frame)),
    ...(cue.motion || (!cue.accent && !cue.soundId) ? {} : { motion: 'follow' }),
  };
}

// An interruption can shorten a sweep before its originally observed destination.
export function cropScreenPath(path, fraction) {
  if (!path || fraction >= 1) return path;
  const kept = path.filter(([t]) => t < fraction);
  const [ta, a] = kept.at(-1), [tb, b] = path[kept.length];
  return [...kept.map(([t, x]) => [t / fraction, x]), [1, a + (b-a)*(fraction-ta)/(tb-ta)]];
}
