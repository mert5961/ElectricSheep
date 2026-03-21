import type { AudioSignals } from '../../audio-analyzer/audioAnalyzerStore.ts';
import type { AudioFeatureSummary } from '../contracts/aiState.ts';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampSignedUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function smoothValue(current: number, target: number, deltaMs: number, timeConstantMs: number): number {
  const safeDeltaMs = Math.max(0, deltaMs);
  const alpha = timeConstantMs <= 0
    ? 1
    : 1 - Math.exp(-safeDeltaMs / timeConstantMs);

  return current + ((target - current) * alpha);
}

function detectDominantEvent(signals: AudioSignals): string {
  const dominantValue = Math.max(signals.kick, signals.snare, signals.hihat);

  if (dominantValue < 0.12) {
    return 'none';
  }

  if (dominantValue === signals.kick) {
    return 'kick';
  }

  if (dominantValue === signals.snare) {
    return 'snare';
  }

  return 'hihat';
}

export class AIFeatureTracker {
  private lastFrameTimeMs: number | null = null;

  private lastEnergyLevel = 0;

  private kickRate = 0;

  private snareRate = 0;

  private hatRate = 0;

  update(signals: AudioSignals, frameTimeMs: number): AudioFeatureSummary {
    const deltaMs = this.lastFrameTimeMs === null
      ? 16.67
      : Math.max(1, frameTimeMs - this.lastFrameTimeMs);

    this.lastFrameTimeMs = frameTimeMs;

    this.kickRate = smoothValue(this.kickRate, clamp01(signals.kick), deltaMs, 420);
    this.snareRate = smoothValue(this.snareRate, clamp01(signals.snare), deltaMs, 460);
    this.hatRate = smoothValue(this.hatRate, clamp01(signals.hihat), deltaMs, 320);

    const energyLevel = clamp01(signals.energy);
    const energyTrend = clampSignedUnit((energyLevel - this.lastEnergyLevel) * 4.5);
    this.lastEnergyLevel = energyLevel;

    const spectralBrightness = clamp01((signals.treble * 0.72) + (signals.mid * 0.28));
    const transientDensity = clamp01(
      (signals.hit * 0.32)
      + (signals.pulse * 0.26)
      + (signals.flux * 0.2)
      + (signals.kick * 0.12)
      + (signals.snare * 0.06)
      + (signals.hihat * 0.04)
    );
    const rhythmActivity = clamp01(
      (this.kickRate * 0.42)
      + (this.snareRate * 0.33)
      + (this.hatRate * 0.25)
    );
    const calmIndex = clamp01(
      1 - (
        (energyLevel * 0.5)
        + (transientDensity * 0.28)
        + (spectralBrightness * 0.08)
        + (rhythmActivity * 0.14)
      )
    );

    return {
      energyLevel,
      energyTrend,
      spectralBrightness,
      transientDensity,
      rhythmActivity,
      calmIndex,
      kickRate: this.kickRate,
      snareRate: this.snareRate,
      hatRate: this.hatRate,
      dominantEvent: detectDominantEvent(signals),
    };
  }
}
