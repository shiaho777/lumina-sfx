import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { publishAsset } from './audio-export.mjs';
import { encodeWav } from '../engine/wav.ts';
import { regionGain } from '../engine/listening-scene.ts';
const json = (x) => Buffer.from(JSON.stringify(x, null, 2) + '\n');
export async function exportSceneReview(scene, reportPath, stemDir, includeSolos = true) {
  const { masterGain, rate, frames, output, seed, regions, listener, viewpoint } = scene;
  const sources = scene.stems.map((s) => ({
    label: s.label,
    id: s.source,
    event:s.event, components:s.components, arrival:s.arrival,
    offsetSec: s.offset / rate,
    placement: s.placement,
    locked: s.locked,
  }));
  const report = { balance:scene.balance, masterGain, rate, frames, output, seed, viewpoint, listener, regions, sources };
  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await publishAsset(reportPath, json(report));
  }
  if (!stemDir) return;
  await mkdir(stemDir, { recursive: true });
  for (const [i, s] of scene.stems.entries()) {
    let region = 0;
    const solo = s.ears.map((c) => c.slice());
    for (let j = 0; j < solo[0].length; j++) {
      const t = (s.offset + j) / rate;
      while (region + 1 < regions.length && t >= regions[region].to) region++;
      const gain = regionGain(regions, region, t, s.label);
      for (const channel of solo) channel[j] *= gain * masterGain;
    }
    // PCM cannot store overs. The manifest reverses any safety trim on the dry stems.
    async function write(channels, name) {
      let peak = 1;
      for (const c of channels) for (const x of c) peak = Math.max(peak, Math.abs(x));
      const file = s.label + '-' + name + '.wav';
      await publishAsset(
        join(stemDir, file),
        Buffer.from(
          encodeWav(
            channels.map((c) => c.map((x) => x / peak)),
            rate,
          ),
        ),
      );
      return { file, restoreGain: peak };
    }
    Object.assign(sources[i], {
      dry: await write(s.dry, 'dry'),
      ...(includeSolos ? { solo: await write(solo, 'solo') } : {}),
    });
  }
  await publishAsset(join(stemDir, 'scene.json'), json({ ...report, schemaVersion: 2 }));
}
