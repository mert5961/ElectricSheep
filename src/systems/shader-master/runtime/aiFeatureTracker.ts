import type { AudioSignals } from '../../audio-analyzer/audioAnalyzerStore.ts';
import type {
  AIPhraseState,
  AISectionState,
  AudioFeatureSummary,
} from '../contracts/aiState.ts';

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

function detectPhraseState({
  phraseEnergyLevel,
  phraseRhythmActivity,
  phraseCalmIndex,
  sectionEnergyLevel,
  sectionRhythmActivity,
  sectionCalmIndex,
  activityConfidence,
}: {
  phraseEnergyLevel: number;
  phraseRhythmActivity: number;
  phraseCalmIndex: number;
  sectionEnergyLevel: number;
  sectionRhythmActivity: number;
  sectionCalmIndex: number;
  activityConfidence: number;
}): AIPhraseState {
  const energyLift = phraseEnergyLevel - sectionEnergyLevel;
  const rhythmLift = phraseRhythmActivity - sectionRhythmActivity;
  const calmLift = phraseCalmIndex - sectionCalmIndex;

  if (activityConfidence < 0.18 && phraseEnergyLevel < 0.2) {
    return 'suspended';
  }

  if (energyLift > 0.09 && rhythmLift > -0.03 && calmLift < -0.04) {
    return 'lifting';
  }

  if (energyLift < -0.1 && rhythmLift < -0.06) {
    return 'thinning';
  }

  if (energyLift < -0.06 && calmLift > 0.05) {
    return 'settling';
  }

  return 'holding';
}

function detectSectionState({
  phraseEnergyLevel,
  phraseBrightness,
  phraseRhythmActivity,
  phraseCalmIndex,
  sectionEnergyLevel,
  sectionBrightness,
  sectionRhythmActivity,
  sectionCalmIndex,
  kickRate,
  changeStrength,
  previousSectionState,
  dominantEvent,
  previousDominantEvent,
}: {
  phraseEnergyLevel: number;
  phraseBrightness: number;
  phraseRhythmActivity: number;
  phraseCalmIndex: number;
  sectionEnergyLevel: number;
  sectionBrightness: number;
  sectionRhythmActivity: number;
  sectionCalmIndex: number;
  kickRate: number;
  changeStrength: number;
  previousSectionState: AISectionState;
  dominantEvent: string;
  previousDominantEvent: string;
}): AISectionState {
  const energyLift = phraseEnergyLevel - sectionEnergyLevel;
  const brightnessLift = phraseBrightness - sectionBrightness;
  const rhythmLift = phraseRhythmActivity - sectionRhythmActivity;
  const calmLift = phraseCalmIndex - sectionCalmIndex;
  const dominantEventChanged = dominantEvent !== previousDominantEvent;

  if (
    phraseEnergyLevel < 0.26
    && phraseRhythmActivity < 0.24
    && phraseCalmIndex > Math.max(0.56, sectionCalmIndex + 0.05)
  ) {
    return 'breakdown';
  }

  if (
    changeStrength > 0.14
    && (
      dominantEventChanged
      || Math.abs(brightnessLift) > 0.07
      || Math.abs(rhythmLift) > 0.08
      || Math.abs(energyLift) > 0.09
    )
  ) {
    return 'transition';
  }

  const buildStrength = clamp01(
    (Math.max(0, energyLift) * 0.4)
    + (Math.max(0, rhythmLift) * 0.24)
    + (Math.max(0, brightnessLift) * 0.16)
    + (Math.max(0, -calmLift) * 0.2)
  );

  if (
    previousSectionState === 'build'
    || previousSectionState === 'transition'
    || previousSectionState === 'breakdown'
  ) {
    const dropStrength = clamp01(
      (Math.max(0, energyLift - 0.03) * 0.34)
      + (Math.max(0, rhythmLift - 0.03) * 0.22)
      + (kickRate * 0.28)
      + (Math.max(0, -calmLift) * 0.16)
    );

    if (dropStrength > 0.14) {
      return 'drop';
    }
  }

  if (buildStrength > 0.12 && phraseRhythmActivity > 0.22) {
    return 'build';
  }

  return 'groove';
}

export class AIFeatureTracker {
  private lastFrameTimeMs: number | null = null;

  private lastEnergyLevel = 0;

  private kickRate = 0;

  private snareRate = 0;

  private hatRate = 0;

  private phraseEnergyLevel = 0;

  private phraseBrightness = 0;

  private phraseRhythmActivity = 0;

  private phraseCalmIndex = 1;

  private sectionEnergyLevel = 0;

  private sectionBrightness = 0;

  private sectionRhythmActivity = 0;

  private sectionCalmIndex = 1;

  private lastDetectedSectionState: AISectionState = 'groove';

  private lastDominantEvent = 'none';

  update(signals: AudioSignals, frameTimeMs: number): AudioFeatureSummary {
    const isFirstFrame = this.lastFrameTimeMs === null;
    const deltaMs = isFirstFrame
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
    const dominantEvent = detectDominantEvent(signals);
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

    if (isFirstFrame) {
      this.phraseEnergyLevel = energyLevel;
      this.phraseBrightness = spectralBrightness;
      this.phraseRhythmActivity = rhythmActivity;
      this.phraseCalmIndex = calmIndex;
      this.sectionEnergyLevel = energyLevel;
      this.sectionBrightness = spectralBrightness;
      this.sectionRhythmActivity = rhythmActivity;
      this.sectionCalmIndex = calmIndex;
    } else {
      this.phraseEnergyLevel = smoothValue(this.phraseEnergyLevel, energyLevel, deltaMs, 4200);
      this.phraseBrightness = smoothValue(this.phraseBrightness, spectralBrightness, deltaMs, 4600);
      this.phraseRhythmActivity = smoothValue(this.phraseRhythmActivity, rhythmActivity, deltaMs, 3800);
      this.phraseCalmIndex = smoothValue(this.phraseCalmIndex, calmIndex, deltaMs, 5000);
      this.sectionEnergyLevel = smoothValue(this.sectionEnergyLevel, energyLevel, deltaMs, 13000);
      this.sectionBrightness = smoothValue(this.sectionBrightness, spectralBrightness, deltaMs, 14000);
      this.sectionRhythmActivity = smoothValue(this.sectionRhythmActivity, rhythmActivity, deltaMs, 12000);
      this.sectionCalmIndex = smoothValue(this.sectionCalmIndex, calmIndex, deltaMs, 15000);
    }

    const activityConfidence = clamp01(
      (this.phraseEnergyLevel * 0.32)
      + (this.phraseRhythmActivity * 0.28)
      + (transientDensity * 0.18)
      + ((1 - this.phraseCalmIndex) * 0.14)
      + (spectralBrightness * 0.08)
    );
    const changeStrength = clamp01(
      (Math.abs(this.phraseEnergyLevel - this.sectionEnergyLevel) * 0.4)
      + (Math.abs(this.phraseRhythmActivity - this.sectionRhythmActivity) * 0.28)
      + (Math.abs(this.phraseBrightness - this.sectionBrightness) * 0.16)
      + (Math.abs(this.phraseCalmIndex - this.sectionCalmIndex) * 0.12)
      + (Math.abs(energyTrend) * 0.14)
      + ((dominantEvent !== this.lastDominantEvent ? 0.08 : 0))
    );

    const phraseState = detectPhraseState({
      phraseEnergyLevel: this.phraseEnergyLevel,
      phraseRhythmActivity: this.phraseRhythmActivity,
      phraseCalmIndex: this.phraseCalmIndex,
      sectionEnergyLevel: this.sectionEnergyLevel,
      sectionRhythmActivity: this.sectionRhythmActivity,
      sectionCalmIndex: this.sectionCalmIndex,
      activityConfidence,
    });
    const sectionState = detectSectionState({
      phraseEnergyLevel: this.phraseEnergyLevel,
      phraseBrightness: this.phraseBrightness,
      phraseRhythmActivity: this.phraseRhythmActivity,
      phraseCalmIndex: this.phraseCalmIndex,
      sectionEnergyLevel: this.sectionEnergyLevel,
      sectionBrightness: this.sectionBrightness,
      sectionRhythmActivity: this.sectionRhythmActivity,
      sectionCalmIndex: this.sectionCalmIndex,
      kickRate: this.kickRate,
      changeStrength,
      previousSectionState: this.lastDetectedSectionState,
      dominantEvent,
      previousDominantEvent: this.lastDominantEvent,
    });

    this.lastDetectedSectionState = sectionState;
    this.lastDominantEvent = dominantEvent;

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
      dominantEvent,
      phraseEnergyLevel: this.phraseEnergyLevel,
      phraseBrightness: this.phraseBrightness,
      phraseRhythmActivity: this.phraseRhythmActivity,
      phraseCalmIndex: this.phraseCalmIndex,
      sectionEnergyLevel: this.sectionEnergyLevel,
      sectionBrightness: this.sectionBrightness,
      sectionRhythmActivity: this.sectionRhythmActivity,
      sectionCalmIndex: this.sectionCalmIndex,
      phraseState,
      sectionState,
      activityConfidence,
      changeStrength,
    };
  }
}
