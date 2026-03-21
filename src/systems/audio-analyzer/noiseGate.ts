function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export interface NoiseGateResult {
  bass: number;
  mid: number;
  treble: number;
  energyFloor: number;
}

const CALIBRATION_DURATION_MS = 500;
const HEADROOM = 1.6;

const RISE_TIME_CONSTANT_MS = 30000;
const FALL_TIME_CONSTANT_MS = 8000;
const CALIBRATION_TIME_CONSTANT_MS = 80;
const FLOOR_RISE_RATIO_GUARD = 1.18;
const FLOOR_RISE_ABSOLUTE_GUARD = 0.015;

export class AdaptiveNoiseGate {
  private bassFloor = 0;

  private midFloor = 0;

  private trebleFloor = 0;

  private energyFloor = 0;

  private elapsedMs = 0;

  private calibrated = false;

  gate(
    rawBass: number,
    rawMid: number,
    rawTreble: number,
    rawEnergy: number,
    deltaTimeMs: number,
  ): NoiseGateResult {
    const frameMs = Math.max(8, deltaTimeMs);
    this.elapsedMs += frameMs;

    const isCalibrating = this.elapsedMs < CALIBRATION_DURATION_MS;

    this.bassFloor = this.trackFloor(this.bassFloor, rawBass, frameMs, isCalibrating);
    this.midFloor = this.trackFloor(this.midFloor, rawMid, frameMs, isCalibrating);
    this.trebleFloor = this.trackFloor(this.trebleFloor, rawTreble, frameMs, isCalibrating);
    this.energyFloor = this.trackFloor(this.energyFloor, rawEnergy, frameMs, isCalibrating);

    if (!this.calibrated && !isCalibrating) {
      this.calibrated = true;
    }

    if (isCalibrating) {
      return { bass: 0, mid: 0, treble: 0, energyFloor: this.energyFloor * HEADROOM };
    }

    return {
      bass: this.applyGate(rawBass, this.bassFloor),
      mid: this.applyGate(rawMid, this.midFloor),
      treble: this.applyGate(rawTreble, this.trebleFloor),
      energyFloor: this.energyFloor * HEADROOM,
    };
  }

  getEnergyFloor(): number {
    return this.energyFloor * HEADROOM;
  }

  reset(): void {
    this.bassFloor = 0;
    this.midFloor = 0;
    this.trebleFloor = 0;
    this.energyFloor = 0;
    this.elapsedMs = 0;
    this.calibrated = false;
  }

  private trackFloor(
    currentFloor: number,
    rawValue: number,
    frameMs: number,
    isCalibrating: boolean,
  ): number {
    if (isCalibrating) {
      const alpha = 1 - Math.exp(-frameMs / CALIBRATION_TIME_CONSTANT_MS);
      return currentFloor + (rawValue - currentFloor) * alpha;
    }

    if (rawValue < currentFloor) {
      const alpha = 1 - Math.exp(-frameMs / FALL_TIME_CONSTANT_MS);
      return currentFloor + (rawValue - currentFloor) * alpha;
    }

    // Only let the floor rise toward a bounded ceiling near the existing
    // floor. This keeps the gate responsive to changing background conditions
    // without letting sustained musical content become the new floor.
    const allowedRiseCeiling = Math.max(
      currentFloor * FLOOR_RISE_RATIO_GUARD,
      currentFloor + FLOOR_RISE_ABSOLUTE_GUARD,
    );
    const timeConstant = RISE_TIME_CONSTANT_MS;
    const alpha = 1 - Math.exp(-frameMs / timeConstant);
    const boundedTarget = Math.min(rawValue, allowedRiseCeiling);
    return currentFloor + (boundedTarget - currentFloor) * alpha;
  }

  private applyGate(rawValue: number, floor: number): number {
    const threshold = floor * HEADROOM;
    if (rawValue <= threshold) {
      return 0;
    }

    const headroom = Math.max(0.001, 1 - threshold);
    return clamp01((rawValue - threshold) / headroom);
  }
}
