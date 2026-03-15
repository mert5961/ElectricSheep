import type { AudioInputDiagnostics } from './audioAnalyzerStore.ts';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeAudioInputDiagnostics(timeDomainData: Uint8Array): AudioInputDiagnostics {
  if (timeDomainData.length === 0) {
    return {
      noiseFloor: 0,
      peakAmplitude: 0,
      dynamicRange: 0,
      dynamicRangeDb: 0,
      clippingWarning: false,
    };
  }

  const amplitudes = new Array(timeDomainData.length);
  let peakAmplitude = 0;
  let clippedSamples = 0;

  for (let index = 0; index < timeDomainData.length; index += 1) {
    const centeredAmplitude = Math.abs((timeDomainData[index] - 128) / 128);
    amplitudes[index] = centeredAmplitude;
    peakAmplitude = Math.max(peakAmplitude, centeredAmplitude);
    if (centeredAmplitude >= 0.985) {
      clippedSamples += 1;
    }
  }

  const sortedAmplitudes = [...amplitudes].sort((left, right) => left - right);
  const noiseSampleCount = Math.max(12, Math.floor(sortedAmplitudes.length * 0.2));
  let noiseFloorAccumulator = 0;
  for (let index = 0; index < noiseSampleCount; index += 1) {
    noiseFloorAccumulator += sortedAmplitudes[index];
  }

  const noiseFloor = clamp01((noiseFloorAccumulator / noiseSampleCount) * 1.5);
  const safePeakAmplitude = Math.max(peakAmplitude, 0.0005);
  const safeNoiseFloor = Math.max(noiseFloor, 0.0005);
  const dynamicRangeDb = Math.max(0, Math.min(60, 20 * Math.log10(safePeakAmplitude / safeNoiseFloor)));
  const clippingWarning = peakAmplitude >= 0.99 || ((clippedSamples / timeDomainData.length) >= 0.01);

  return {
    noiseFloor,
    peakAmplitude: clamp01(peakAmplitude),
    dynamicRange: clamp01(dynamicRangeDb / 36),
    dynamicRangeDb,
    clippingWarning,
  };
}
