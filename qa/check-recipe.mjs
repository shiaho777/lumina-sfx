import { renderDurationSec } from '../engine/sculpt.ts';
import { checkListeningMaster } from './listening-master.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { DEFAULT_SEED, renderSound, renderChannels, SAMPLE_RATE } from '../engine/render.ts';
import { encodeWav } from '../engine/wav.ts';
import { balanceLevels, balanceSettings, measureLevel, resolveMixRole } from '../engine/levels.ts';
import { checkLoop, decodeWav, inspect, inspectBalanced } from './metrics.mjs';
import { writeFile, rename, rm } from 'node:fs/promises';
const seedCount = 4;
export async function publish(path, bytes) {
  const temp = path + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, bytes);
    await rename(temp, path);
  } finally { await rm(temp, { force: true }); }
}


export async function checkRecipe(recipe, { extremes = false, bothLevels = false, wavPath } = {}) {
  const variants = [];
  let candidate;
  for (const setting of extremes ? ['default', 'min', 'max'] : ['default']) {
    const params = Object.fromEntries(Object.entries(recipe.params).map(([key, spec]) => [key, spec[setting]]));
    for (let variant = 0; variant < seedCount; variant++) {
      const seed = DEFAULT_SEED + variant * 8191;
      const entry = extremes ? { seed, setting } : { seed };
      try {
        if(recipe.preserveTimeline) {
          const first=setting==='default' && variant===0;
          const {master,checks}=checkListeningMaster(recipe,{seed,params},first && bothLevels);
          if(first) candidate=Buffer.from(master);
          variants.push({...entry,pass:Object.values(checks).every(c=>c.pass),checks});
          continue;
        }
        const original = renderSound(recipe, { seed, params });
        const wav = encodeWav(original);
        const pcm = decodeWav(wav, SAMPLE_RATE);
        if (pcm.length !== Math.round(renderDurationSec(recipe) * SAMPLE_RATE)) throw new Error('WAV duration mismatch');
        const checks = inspect(pcm, recipe, SAMPLE_RATE);
        let master = wav;
        if (recipe.renderStereo) {
          const channels = renderChannels(recipe, { seed, params });
          master = encodeWav(channels);
          let energy = 0, sumEnergy = 0, sideEnergy = 0, peak = 0;
          for (let i = 0; i < channels[0].length; i++) {
            const a = channels[0][i], b = channels[1][i];
            energy += (a*a + b*b)/2;
            sumEnergy += ((a+b)/2)**2;
            sideEnergy += ((a-b)/2)**2;
            peak = Math.max(peak, Math.abs(a), Math.abs(b));
          }
          const foldRatio = sumEnergy/energy, sideRatio = sideEnergy/energy;
          checks.stereo = { pass: peak <= 10**(-0.5/20) && foldRatio > 0.25 && sideRatio > 1e-6 &&
            master.byteLength === 44 + pcm.length*4 && new DataView(master).getUint16(22, true) === 2,
            foldRatio, sideRatio, peak };
          if (recipe.loopable) {
            const sides = channels.map(channel => checkLoop(channel, SAMPLE_RATE));
            checks.stereoBoundary = { pass: sides.every(side => side.pass), sides };
          }
          if (!recipe.loopable) {
            const floor = Math.max(0.001, peak*0.02);
            const frame = channels[0].findIndex((v,i) => Math.max(Math.abs(v), Math.abs(channels[1][i])) >= floor);
            const ms = frame < 0 ? null : frame*1000/SAMPLE_RATE;
            checks.stereoOnset = { pass: ms !== null && ms < 1, ms, maxMsExclusive: 1 };
          }
          if (bothLevels) {
            const role = resolveMixRole(recipe);
            const settings = channels.map(c => balanceSettings(c, SAMPLE_RATE, role));
            const linkedGain = Math.min(...settings.map(s => s.gainDb));
            const balanced = renderChannels(recipe, { seed, params, level: 'balanced' });
            const sides = balanced.map((c, i) => {
              const measured = measureLevel(c, SAMPLE_RATE);
              return { peak: measured.peakDbfs, gain: measured.activeDb-settings[i].activeDb };
            });
            checks.stereoBalanced = { pass: sides.every(s => s.peak <= settings[0].ceilingDbfs+.01 &&
              Math.abs(s.gain-linkedGain)<.1), linkedGain, sides };
            if (setting === 'default' && variant === 0) {
              const repeat = encodeWav(renderChannels(recipe, { seed, params }));
              checks.stereoDeterministic = { pass: Buffer.from(master).equals(Buffer.from(repeat)) };
            }
          }
        }
        if (setting === 'default' && variant === 0) candidate = Buffer.from(master);
        if (bothLevels) {
          const role = resolveMixRole(recipe);
          const settings = balanceSettings(original, SAMPLE_RATE, role);
          const balanced = decodeWav(encodeWav(balanceLevels(original, SAMPLE_RATE, role)), SAMPLE_RATE);
          checks.balanced = inspectBalanced(balanced, recipe, SAMPLE_RATE, settings, measureLevel(balanced, SAMPLE_RATE));
          if (setting === 'default' && variant === 0) {
            const repeat = encodeWav(renderSound(recipe, { seed, params }));
            checks.deterministic = { pass: Buffer.from(wav).equals(Buffer.from(repeat)) };
          }
        }
        variants.push({ ...entry, pass: Object.values(checks).every((check) => check === null || check.pass), checks });
      } catch (error) {
        variants.push({ ...entry, pass: false, error: error.message });
      }
    }
  }
  const pass = variants.every(v => v.pass);
  if (pass && wavPath) await publish(wavPath, candidate);
  return { id: recipe.id, channels: recipe.renderStereo ? 2 : 1, loopable: recipe.loopable, pass,
    wav: pass ? wavPath ?? null : null, masterSha256: pass ? createHash('sha256').update(candidate).digest('hex') : null, variants };

}
