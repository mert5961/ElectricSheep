function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function exponentialApproach(
  current: number,
  target: number,
  deltaTimeMs: number,
  timeConstantMs: number,
): number {
  if (timeConstantMs <= 0) {
    return target;
  }

  const alpha = 1 - Math.exp(-deltaTimeMs / timeConstantMs);
  return current + ((target - current) * alpha);
}

export class PulseDetector {
  private baseline = 0;

  private pulse = 0;

  private lastDriver = 0;

  private cooldownRemainingMs = 0;

  update({
    bass,
    energy,
    deltaTimeMs,
    decayMs = 240,
    cooldownMs = 180,
  }: {
    bass: number;
    energy: number;
    deltaTimeMs: number;
    decayMs?: number;
    cooldownMs?: number;
  }): number {
    const frameTimeMs = Math.max(8, deltaTimeMs);
    const driver = clamp01((bass * 0.72) + (energy * 0.28));
    const baselineTimeConstantMs = driver > this.baseline ? 180 : 540;
    this.baseline = exponentialApproach(this.baseline, driver, frameTimeMs, baselineTimeConstantMs);
    this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - frameTimeMs);

    const rise = driver - this.lastDriver;
    const threshold = Math.min(0.95, Math.max(0.12, (this.baseline * 1.16) + 0.08));
    const shouldTrigger = this.cooldownRemainingMs <= 0 && driver > threshold && rise > 0.015;

    if (shouldTrigger) {
      this.pulse = 1;
      this.cooldownRemainingMs = cooldownMs;
    } else {
      this.pulse = exponentialApproach(this.pulse, 0, frameTimeMs, decayMs);
      if (driver > threshold * 0.94) {
        const accent = clamp01((driver - this.baseline) * 2.8);
        this.pulse = Math.max(this.pulse, accent);
      }
    }

    this.lastDriver = driver;
    return clamp01(this.pulse);
  }

  reset(): void {
    this.baseline = 0;
    this.pulse = 0;
    this.lastDriver = 0;
    this.cooldownRemainingMs = 0;
  }
}
