import type { AutomationPoint } from './score.ts';

export function readAutomation(points: readonly AutomationPoint[], span: number, loop: boolean): (beat: number) => number {
  const first = points[0], last = points[points.length - 1];
  if (points.length === 1) return () => first[1];
  let index = 0;
  function between(beat: number, from: AutomationPoint, to: AutomationPoint): number {
    if (to[0] <= from[0]) return to[1];
    return from[1] + (to[1] - from[1]) * ((beat - from[0]) / (to[0] - from[0]));
  }
  return beat => {
    if (loop && beat >= span) beat %= span;
    if (beat < first[0]) return loop ? between(beat, [last[0] - span, last[1]], first) : first[1];
    if (beat > last[0]) return loop ? between(beat, last, [first[0] + span, first[1]]) : last[1];
    if (beat < points[index][0]) index = 0;
    while (index < points.length - 2 && beat > points[index + 1][0]) index++;
    return between(beat, points[index], points[index + 1]);
  };
}
