import type { AudioSignals } from './audioAnalyzerStore.ts';

export interface FrequencyBandResult {
  bass: AudioSignals['bass'];
  mid: AudioSignals['mid'];
  treble: AudioSignals['treble'];
}

export interface SpectrumBarsResult {
  bars: number[];
}

interface FrequencyBandDefinition {
  key: keyof FrequencyBandResult;
  minHz: number;
  maxHz: number;
  gain: number;
  curve: number;
}

const FREQUENCY_BANDS: FrequencyBandDefinition[] = [
  { key: 'bass', minHz: 20, maxHz: 250, gain: 1.45, curve: 0.72 },
  { key: 'mid', minHz: 250, maxHz: 2000, gain: 1.32, curve: 0.78 },
  { key: 'treble', minHz: 2000, maxHz: 12000, gain: 1.6, curve: 0.7 },
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function frequencyToBinIndex(
  frequencyHz: number,
  sampleRate: number,
  fftSize: number,
  frequencyBinCount: number,
): number {
  const clampedFrequency = Math.max(0, frequencyHz);
  const nyquist = sampleRate * 0.5;
  if (nyquist <= 0 || fftSize <= 0 || frequencyBinCount <= 0) {
    return 0;
  }

  const normalizedFrequency = Math.min(clampedFrequency, nyquist);
  const binIndex = Math.round((normalizedFrequency / nyquist) * (frequencyBinCount - 1));
  return Math.max(0, Math.min(frequencyBinCount - 1, binIndex));
}

function computeBandLevel(
  frequencyData: Uint8Array,
  startIndex: number,
  endIndex: number,
  gain: number,
  curve: number,
): number {
  let sumSquares = 0;
  let peak = 0;
  let binCount = 0;

  for (let index = startIndex; index <= endIndex; index += 1) {
    const magnitude = frequencyData[index] / 255;
    sumSquares += magnitude * magnitude;
    peak = Math.max(peak, magnitude);
    binCount += 1;
  }

  if (binCount === 0) {
    return 0;
  }

  const rms = Math.sqrt(sumSquares / binCount);
  const blendedMagnitude = (rms * 0.78) + (peak * 0.22);
  return clamp01(Math.pow(blendedMagnitude, curve) * gain);
}

export function computeFrequencyBands({
  frequencyData,
  sampleRate,
  fftSize,
}: {
  frequencyData: Uint8Array;
  sampleRate: number;
  fftSize: number;
}): FrequencyBandResult {
  const result: FrequencyBandResult = {
    bass: 0,
    mid: 0,
    treble: 0,
  };

  FREQUENCY_BANDS.forEach((band) => {
    const startIndex = frequencyToBinIndex(band.minHz, sampleRate, fftSize, frequencyData.length);
    const endIndex = frequencyToBinIndex(band.maxHz, sampleRate, fftSize, frequencyData.length);
    result[band.key] = computeBandLevel(
      frequencyData,
      Math.min(startIndex, endIndex),
      Math.max(startIndex, endIndex),
      band.gain,
      band.curve,
    );
  });

  return result;
}

export function computeSpectrumBars({
  frequencyData,
  sampleRate,
  fftSize,
  barCount = 32,
  minHz = 20,
  maxHz = 12000,
}: {
  frequencyData: Uint8Array;
  sampleRate: number;
  fftSize: number;
  barCount?: number;
  minHz?: number;
  maxHz?: number;
}): SpectrumBarsResult {
  if (barCount <= 0) {
    return {
      bars: [],
    };
  }

  const bars = new Array(barCount).fill(0);
  const safeMinHz = Math.max(1, minHz);
  const safeMaxHz = Math.max(safeMinHz + 1, maxHz);
  const frequencyRatio = safeMaxHz / safeMinHz;

  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    const startT = barIndex / barCount;
    const endT = (barIndex + 1) / barCount;
    const startHz = safeMinHz * Math.pow(frequencyRatio, startT);
    const endHz = safeMinHz * Math.pow(frequencyRatio, endT);
    const startIndex = frequencyToBinIndex(startHz, sampleRate, fftSize, frequencyData.length);
    const endIndex = frequencyToBinIndex(endHz, sampleRate, fftSize, frequencyData.length);

    let peak = 0;
    let sum = 0;
    let count = 0;
    for (let index = Math.min(startIndex, endIndex); index <= Math.max(startIndex, endIndex); index += 1) {
      const magnitude = frequencyData[index] / 255;
      peak = Math.max(peak, magnitude);
      sum += magnitude;
      count += 1;
    }

    const average = count > 0 ? sum / count : 0;
    const shaped = (average * 0.58) + (peak * 0.42);
    bars[barIndex] = clamp01(Math.pow(shaped, 0.68) * 1.5);
  }

  return {
    bars,
  };
}
