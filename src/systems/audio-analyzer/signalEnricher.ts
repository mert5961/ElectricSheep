function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

class DampedSpring {
  private position = 0;

  private velocity = 0;

  private readonly stiffness: number;

  private readonly damping: number;

  constructor(stiffness = 12, damping = 4) {
    this.stiffness = stiffness;
    this.damping = damping;
  }

  update(target: number, deltaTimeSec: number): number {
    const dt = Math.min(deltaTimeSec, 0.05);
    this.velocity += (target - this.position) * this.stiffness * dt;
    this.velocity *= Math.exp(-this.damping * dt);
    this.position += this.velocity * dt;
    return clamp01(this.position);
  }

  reset(): void {
    this.position = 0;
    this.velocity = 0;
  }
}

class PeakHoldEnvelope {
  private peak = 0;

  private holdRemainingMs = 0;

  private readonly holdDurationMs: number;

  private readonly decayMs: number;

  private readonly riseThreshold: number;

  constructor(holdDurationMs = 80, decayMs = 600, riseThreshold = 0.08) {
    this.holdDurationMs = holdDurationMs;
    this.decayMs = decayMs;
    this.riseThreshold = riseThreshold;
  }

  update(driver: number, deltaTimeMs: number): number {
    const frameMs = Math.max(8, deltaTimeMs);

    if (driver > this.peak + this.riseThreshold || driver > this.peak) {
      if (driver > this.peak) {
        this.peak = driver;
        this.holdRemainingMs = this.holdDurationMs;
      }
    } else if (this.holdRemainingMs > 0) {
      this.holdRemainingMs -= frameMs;
    } else {
      this.peak *= Math.exp(-frameMs / this.decayMs);
    }

    return clamp01(this.peak);
  }

  reset(): void {
    this.peak = 0;
    this.holdRemainingMs = 0;
  }
}

class SpectralFluxMeter {
  private previousFrame: Float32Array | null = null;

  private smoothedFlux = 0;

  private readonly smoothingMs: number;

  constructor(smoothingMs = 120) {
    this.smoothingMs = smoothingMs;
  }

  update(frequencyData: Uint8Array, deltaTimeMs: number): number {
    const currentFrame = new Float32Array(frequencyData.length);
    for (let i = 0; i < frequencyData.length; i++) {
      currentFrame[i] = frequencyData[i] / 255;
    }

    if (!this.previousFrame) {
      this.previousFrame = currentFrame;
      return 0;
    }

    let sumDiff = 0;
    const binCount = Math.min(currentFrame.length, this.previousFrame.length);
    for (let i = 0; i < binCount; i++) {
      const diff = currentFrame[i] - this.previousFrame[i];
      sumDiff += Math.max(0, diff);
    }

    const rawFlux = binCount > 0 ? sumDiff / binCount : 0;
    const normalizedFlux = clamp01(rawFlux * 8.0);

    const frameMs = Math.max(8, deltaTimeMs);
    const alpha = 1 - Math.exp(-frameMs / this.smoothingMs);
    this.smoothedFlux += (normalizedFlux - this.smoothedFlux) * alpha;

    this.previousFrame = currentFrame;
    return clamp01(this.smoothedFlux);
  }

  reset(): void {
    this.previousFrame = null;
    this.smoothedFlux = 0;
  }
}

class SlowAccumulator {
  private value = 0;

  private readonly timeConstantMs: number;

  constructor(timeConstantMs = 3000) {
    this.timeConstantMs = timeConstantMs;
  }

  update(input: number, deltaTimeMs: number): number {
    const frameMs = Math.max(8, deltaTimeMs);
    const alpha = 1 - Math.exp(-frameMs / this.timeConstantMs);
    this.value += (input - this.value) * alpha;
    return clamp01(this.value);
  }

  reset(): void {
    this.value = 0;
  }
}

export interface EnrichedSignals {
  bassSmooth: number;
  hit: number;
  flux: number;
  rumble: number;
}

export interface SignalEnricherInput {
  bass: number;
  energy: number;
  frequencyData: Uint8Array;
  deltaTimeMs: number;
}

export class SignalEnricher {
  private readonly bassSpring = new DampedSpring(12, 4);

  private readonly hitEnvelope = new PeakHoldEnvelope(80, 600, 0.08);

  private readonly fluxMeter = new SpectralFluxMeter(120);

  private readonly rumbleAccumulator = new SlowAccumulator(3000);

  update(input: SignalEnricherInput): EnrichedSignals {
    const dtSec = input.deltaTimeMs / 1000;
    const hitDriver = clamp01((input.bass * 0.7) + (input.energy * 0.3));

    return {
      bassSmooth: this.bassSpring.update(input.bass, dtSec),
      hit: this.hitEnvelope.update(hitDriver, input.deltaTimeMs),
      flux: this.fluxMeter.update(input.frequencyData, input.deltaTimeMs),
      rumble: this.rumbleAccumulator.update(input.energy, input.deltaTimeMs),
    };
  }

  reset(): void {
    this.bassSpring.reset();
    this.hitEnvelope.reset();
    this.fluxMeter.reset();
    this.rumbleAccumulator.reset();
  }
}
