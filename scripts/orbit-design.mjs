// The same headphone route can carry any single catalog action. Compress the
// trajectory for a short one-shot and retain its attack and tail.
import { readFile } from 'node:fs/promises';
export async function orbitDesign(entry, layer, options = {}) {
  const template = JSON.parse(
    await readFile(new URL('../references/listening-scenes/orbit-and-turn.json', import.meta.url)),
  );
  const reference = template.layers[0],
    duration = entry.loopable ? reference.durationSec : entry.durationSec;
  const scale = duration / reference.durationSec;
  const path = (keys) => keys.map((k) => ({ ...k, at: k.at * scale }));
  return {
    schemaVersion: 2,
    id: options.id ?? entry.id + '-orbit',
    name: options.name,
    balance: 'natural',
    output: 'headphones',
    scope: 'mixed',
    sourcePolicy: options.clean ? 'clean' : 'field',
    viewpoint: 'One source circles the listener, who turns toward it.',
    listener: { ...template.listener, path: path(template.listener.path) },
    layers: [
      {
        ...layer,
        label: 'source',
        event: 'orbiting-source',
        ...(entry.loopable ? { durationSec: duration, envelope: reference.envelope } : {}),
        placement: { ...reference.placement, path: path(reference.placement.path) },
      },
    ],
  };
}
