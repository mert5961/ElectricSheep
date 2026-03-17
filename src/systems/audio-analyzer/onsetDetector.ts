import { frequencyToBinIndex } from './frequencyBands.ts';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

interface OnsetChannelConfig {
  minHz: number;
  maxHz: number;
  onsetThreshold: number;
  minRise: number;
  baselineTimeConstantMs: number;
  holdDurationMs: number;
  decayMs: number;
  cooldownMs: number;
}

const KICK_CONFIG: OnsetChannelConfig = {
  minHz: 20,
  maxHz: 120,
  onsetThreshold: 0.10,
  minRise: 0.015,
  baselineTimeConstantMs: 600,
  holdDurationMs: 60,
  decayMs: 400,
  cooldownMs: 120,
};

const SNARE_CONFIG: OnsetChannelConfig = {
  minHz: 300,
  maxHz: 3000,
  onsetThreshold: 0.08,
  minRise: 0.012,
  baselineTimeConstantMs: 500,
  holdDurationMs: 40,
  decayMs: 300,
  cooldownMs: 80,
};

const HIHAT_CONFIG: OnsetChannelConfig = {
  minHz: 5000,
  maxHz: 16000,
  onsetThreshold: 0.04,
  minRise: 0.008,
  baselineTimeConstantMs: 350,
  holdDurationMs: 25,
  decayMs: 150,
  cooldownMs: 45,
};

class OnsetChannel {
  private readonly config: OnsetChannelConfig;

  private baseline = 0;

  private previousLevel = 0;

  private envelope = 0;

  private holdRemainingMs = 0;

  private cooldownRemainingMs = 0;

  private inhibitRemainingMs = 0;

  firedThisFrame = false;

  constructor(config: OnsetChannelConfig) {
    this.config = config;
  }

  inhibit(durationMs: number): void {
    this.inhibitRemainingMs = Math.max(this.inhibitRemainingMs, durationMs);
  }

  update(
    frequencyData: Uint8Array,
    sampleRate: number,
    fftSize: number,
    deltaTimeMs: number,
  ): number {
    const frameMs = Math.max(8, deltaTimeMs);
    const binCount = frequencyData.length;
    this.firedThisFrame = false;

    const startBin = frequencyToBinIndex(this.config.minHz, sampleRate, fftSize, binCount);
    const endBin = frequencyToBinIndex(this.config.maxHz, sampleRate, fftSize, binCount);
    const lo = Math.min(startBin, endBin);
    const hi = Math.max(startBin, endBin);

    let sumSquares = 0;
    let peak = 0;
    let count = 0;
    for (let i = lo; i <= hi; i++) {
      const mag = frequencyData[i] / 255;
      sumSquares += mag * mag;
      peak = Math.max(peak, mag);
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    const level = (rms * 0.7) + (peak * 0.3);

    const baselineAlpha = 1 - Math.exp(-frameMs / this.config.baselineTimeConstantMs);
    this.baseline += (level - this.baseline) * baselineAlpha;

    const rise = level - this.previousLevel;
    const exceedance = level - this.baseline;
    this.previousLevel = level;

    this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - frameMs);
    this.inhibitRemainingMs = Math.max(0, this.inhibitRemainingMs - frameMs);

    const shouldTrigger =
      this.cooldownRemainingMs <= 0 &&
      this.inhibitRemainingMs <= 0 &&
      exceedance > this.config.onsetThreshold &&
      rise > this.config.minRise;

    if (shouldTrigger) {
      this.envelope = 1;
      this.holdRemainingMs = this.config.holdDurationMs;
      this.cooldownRemainingMs = this.config.cooldownMs;
      this.firedThisFrame = true;
    } else if (this.holdRemainingMs > 0) {
      this.holdRemainingMs -= frameMs;
    } else {
      this.envelope *= Math.exp(-frameMs / this.config.decayMs);
    }

    return clamp01(this.envelope);
  }

  reset(): void {
    this.baseline = 0;
    this.previousLevel = 0;
    this.envelope = 0;
    this.holdRemainingMs = 0;
    this.cooldownRemainingMs = 0;
    this.inhibitRemainingMs = 0;
    this.firedThisFrame = false;
  }
}

export interface OnsetResult {
  kick: number;
  snare: number;
  hihat: number;
}

export class OnsetDetector {
  private readonly kickChannel = new OnsetChannel(KICK_CONFIG);

  private readonly snareChannel = new OnsetChannel(SNARE_CONFIG);

  private readonly hihatChannel = new OnsetChannel(HIHAT_CONFIG);

  update(
    frequencyData: Uint8Array,
    sampleRate: number,
    fftSize: number,
    deltaTimeMs: number,
  ): OnsetResult {
    const kick = this.kickChannel.update(frequencyData, sampleRate, fftSize, deltaTimeMs);

    if (this.kickChannel.firedThisFrame) {
      this.snareChannel.inhibit(40);
    }

    const snare = this.snareChannel.update(frequencyData, sampleRate, fftSize, deltaTimeMs);
    const hihat = this.hihatChannel.update(frequencyData, sampleRate, fftSize, deltaTimeMs);

    return { kick, snare, hihat };
  }

  reset(): void {
    this.kickChannel.reset();
    this.snareChannel.reset();
    this.hihatChannel.reset();
  }
}
