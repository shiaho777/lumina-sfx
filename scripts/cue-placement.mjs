import { sourcePerspective } from './source-perspective.mjs';
// Named field perspectives already contain their distance. Treat a dry point source as placeable.
export function cuePlacement(sound, request, moving) {
  const evidence=sourcePerspective(sound);
  if (evidence.local && !(evidence.physicalInput && (moving || /distant|far away/i.test(request)))) return {motion:'listener-fixed',placement:{kind:'listener'}};
  if (moving && evidence.motion) return {motion:'in-source',guide:'references/listening-scenes.md'};
  if (moving && sound.id === 'phone-ring-bell') {
    return { motion: 'pass-by', file: 'references/listening-scenes/passing-bell.json' };
  }
  const far = /\b(?:distant|far away)\b/i.test(request);
  if (
    !moving &&
    (!far ||
      /\b(?:distant|far|valley)\b/i.test(sound.id.replaceAll('-', ' ') + ' ' + (sound.perspective ?? '')))
  )
    return;
  // A longer loop can cross the listener. A short single contact should only move for its natural duration.
  const duration = sound.loopable ? 5 : sound.durationSec;
  const span = Math.min(16, duration * 2.8);
  const distance = far ? 26 : 2.5;
  const placement = {
    kind: 'point',
    position: [moving ? -span : 0, 0.4, -distance],
    refDistance: far ? 4 : 1.5,
  };
  if (moving) placement.path = [{ at: duration, position: [span, 0.4, -distance] }];
  return {
    motion: moving ? 'pass-by' : 'stationary',
    guide: 'references/listening-scenes.md',
    design: {
      schemaVersion: 2,
      id: sound.id + (moving ? '-pass' : '-at-distance'),
      scope: 'world',
      balance: 'natural',
      output: 'headphones',
      layers: [
        { id: sound.id, label: 'source', ...(sound.loopable ? { durationSec: duration } : {}), placement },
      ],
    },
  };
}
