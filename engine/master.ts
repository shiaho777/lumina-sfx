import { dbToGain } from './dsp.ts';
import { measureLoudness, samplePeakDb, truePeakDb } from './meter.ts';
import { limit } from './signal.ts';

export type StereoPcm = [Float32Array, Float32Array];

interface MasterSettings {
  master: { targetLufs: number; ceilingDbtp: number };
  loop: boolean;
}

export const roundMeasurement = (value: number): number | null => Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;

export function scaleStereo(channels: StereoPcm, gain: number): void {
  if (gain === 1) return;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= gain;
}

function cyclicPeak(channels: StereoPcm, loop: boolean): number {
  const peak = truePeakDb(channels);
  if (!loop) return peak;
  const edge = 64;
  const aroundSeam = channels.map(channel => {
    const joined = new Float32Array(2 * edge);
    joined.set(channel.subarray(channel.length - edge));
    joined.set(channel.subarray(0, edge), edge);
    for (let i = 0; i < edge / 2; i++) {
      const fade = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / edge);
      joined[i] *= fade;
      joined[joined.length - 1 - i] *= fade;
    }
    return joined;
  });
  return Math.max(peak, truePeakDb(aroundSeam));
}

export function masterAudio(channels: StereoPcm, settings: MasterSettings, rate: number, normalize = true) {
  const { targetLufs, ceilingDbtp } = settings.master;
  const before = normalize ? measureLoudness(channels, rate) : undefined;
  const loudnessGainDb = before && Number.isFinite(before.integrated) ? targetLufs - before.integrated : 0;
  scaleStereo(channels, dbToGain(loudnessGainDb));

  const headroomCeiling = ceilingDbtp - 0.05;
  let limiterReductionDb = 0;
  if (samplePeakDb(channels) > headroomCeiling) {
    const result = limit(channels[0], channels[1], { rate, ceiling: dbToGain(headroomCeiling), loop: settings.loop });
    limiterReductionDb = result.reductionDb;
  }
  const measuredPeak = cyclicPeak(channels, settings.loop);
  const truePeakTrimDb = Math.min(0, headroomCeiling - measuredPeak);
  scaleStereo(channels, dbToGain(truePeakTrimDb));

  const after = measureLoudness(channels, rate);
  return {
    targetLufs,
    ceilingDbtp,
    integratedLufs: roundMeasurement(after.integrated),
    momentaryMaxLufs: roundMeasurement(after.momentaryMax),
    shortTermMaxLufs: roundMeasurement(after.shortTermMax),
    loudnessRangeLu: roundMeasurement(after.lra),
    samplePeakDbfs: roundMeasurement(samplePeakDb(channels)),
    truePeakDbtp: roundMeasurement(measuredPeak + truePeakTrimDb),
    loudnessGainDb: roundMeasurement(loudnessGainDb),
    limiterReductionDb: roundMeasurement(limiterReductionDb),
    truePeakTrimDb: roundMeasurement(truePeakTrimDb),
  };
}
