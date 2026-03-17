export const AUDIO_VISUAL_SIGNAL_KEYS = [
  'u_audioBass',
  'u_audioMid',
  'u_audioTreble',
  'u_audioEnergy',
  'u_audioPulse',
  'u_audioBassSmooth',
  'u_audioHit',
  'u_audioFlux',
  'u_audioRumble',
  'u_audioKick',
  'u_audioSnare',
  'u_audioHihat',
] as const;

export type AudioVisualSignalUniformKey = typeof AUDIO_VISUAL_SIGNAL_KEYS[number];

export interface AudioVisualSignalDefinition {
  key: AudioVisualSignalUniformKey;
  label: string;
  role: string;
  defaultGain: number;
  defaultThreshold: number;
  defaultCurve: number;
}

export interface AudioVisualSignalTuning {
  enabled: boolean;
  gain: number;
  threshold: number;
  curve: number;
}

export interface AudioVisualMappingState {
  soloKey: AudioVisualSignalUniformKey | null;
  signals: Record<AudioVisualSignalUniformKey, AudioVisualSignalTuning>;
}

export const AUDIO_VISUAL_SIGNAL_DEFINITIONS: AudioVisualSignalDefinition[] = [
  {
    key: 'u_audioBass',
    label: 'Bass',
    role: 'Large motion and structural weight',
    defaultGain: 0.95,
    defaultThreshold: 0.02,
    defaultCurve: 1.0,
  },
  {
    key: 'u_audioMid',
    label: 'Mid',
    role: 'Secondary movement and texture modulation',
    defaultGain: 0.78,
    defaultThreshold: 0.05,
    defaultCurve: 1.08,
  },
  {
    key: 'u_audioTreble',
    label: 'Treble',
    role: 'Fine shimmer and edge detail',
    defaultGain: 0.58,
    defaultThreshold: 0.1,
    defaultCurve: 1.35,
  },
  {
    key: 'u_audioEnergy',
    label: 'Energy',
    role: 'Overall activity and intensity bed',
    defaultGain: 0.72,
    defaultThreshold: 0.08,
    defaultCurve: 1.12,
  },
  {
    key: 'u_audioPulse',
    label: 'Pulse',
    role: 'Short accent hits and rhythmic flashes',
    defaultGain: 0.88,
    defaultThreshold: 0.03,
    defaultCurve: 1.0,
  },
  {
    key: 'u_audioBassSmooth',
    label: 'Bass Smooth',
    role: 'Slow gravitational weight for large-scale motion',
    defaultGain: 1.0,
    defaultThreshold: 0.02,
    defaultCurve: 0.85,
  },
  {
    key: 'u_audioHit',
    label: 'Hit',
    role: 'Punchy peak-hold transient envelope for bloom and flash',
    defaultGain: 1.0,
    defaultThreshold: 0.04,
    defaultCurve: 1.0,
  },
  {
    key: 'u_audioFlux',
    label: 'Flux',
    role: 'Spectral change rate, high during rhythm, low during sustain',
    defaultGain: 0.9,
    defaultThreshold: 0.06,
    defaultCurve: 1.1,
  },
  {
    key: 'u_audioRumble',
    label: 'Rumble',
    role: 'Very slow energy accumulator for tidal color and breathing',
    defaultGain: 1.0,
    defaultThreshold: 0.02,
    defaultCurve: 0.75,
  },
  {
    key: 'u_audioKick',
    label: 'Kick',
    role: 'Low-frequency onset event for punchy radial bloom and expansion',
    defaultGain: 1.0,
    defaultThreshold: 0.05,
    defaultCurve: 1.0,
  },
  {
    key: 'u_audioSnare',
    label: 'Snare',
    role: 'Mid-frequency onset event for sharp accent ring and brightness spike',
    defaultGain: 0.9,
    defaultThreshold: 0.06,
    defaultCurve: 1.0,
  },
  {
    key: 'u_audioHihat',
    label: 'Hihat',
    role: 'High-frequency onset event for fine sparkle burst and edge highlight',
    defaultGain: 0.8,
    defaultThreshold: 0.08,
    defaultCurve: 1.15,
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sanitizeAudioVisualSignalTuning(
  tuning: Partial<AudioVisualSignalTuning>,
  fallback: AudioVisualSignalTuning,
): AudioVisualSignalTuning {
  return {
    enabled: tuning.enabled !== undefined ? Boolean(tuning.enabled) : fallback.enabled,
    gain: tuning.gain !== undefined ? clamp(tuning.gain, 0, 2) : fallback.gain,
    threshold: tuning.threshold !== undefined ? clamp(tuning.threshold, 0, 0.95) : fallback.threshold,
    curve: tuning.curve !== undefined ? clamp(tuning.curve, 0.35, 3) : fallback.curve,
  };
}

export function createDefaultAudioVisualMappingState(): AudioVisualMappingState {
  const signals = AUDIO_VISUAL_SIGNAL_DEFINITIONS.reduce<
    Record<AudioVisualSignalUniformKey, AudioVisualSignalTuning>
  >((accumulator, definition) => {
    accumulator[definition.key] = {
      enabled: true,
      gain: definition.defaultGain,
      threshold: definition.defaultThreshold,
      curve: definition.defaultCurve,
    };
    return accumulator;
  }, {} as Record<AudioVisualSignalUniformKey, AudioVisualSignalTuning>);

  return {
    soloKey: null,
    signals,
  };
}

export function cloneAudioVisualMappingState(
  state: AudioVisualMappingState,
): AudioVisualMappingState {
  return {
    soloKey: state.soloKey,
    signals: AUDIO_VISUAL_SIGNAL_KEYS.reduce<Record<AudioVisualSignalUniformKey, AudioVisualSignalTuning>>(
      (accumulator, key) => {
        accumulator[key] = {
          ...state.signals[key],
        };
        return accumulator;
      },
      {} as Record<AudioVisualSignalUniformKey, AudioVisualSignalTuning>,
    ),
  };
}
