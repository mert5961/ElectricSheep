export interface AudioSignals {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  pulse: number;
}

export type AudioAnalyzerSource = 'manual' | 'microphone' | 'display' | 'test-generator';
export type AudioAnalyzerStatus = 'idle' | 'requesting' | 'running' | 'error';
export type AudioAnalyzerTestMode =
  | 'bass-tone'
  | 'mid-tone'
  | 'treble-tone'
  | 'step-test'
  | 'ramp-test'
  | 'sweep-test'
  | 'pulse-click';

export const AUDIO_ANALYZER_SPECTRUM_BAR_COUNT = 32;
export const AUDIO_ANALYZER_SPECTROGRAM_BAND_COUNT = 32;
export const AUDIO_ANALYZER_SPECTROGRAM_HISTORY_LENGTH = 72;

export interface AudioAnalyzerDebugConfig {
  attackMs: number;
  releaseMs: number;
  pulseDecayMs: number;
  pulseCooldownMs: number;
  smoothingBypass: boolean;
}

export interface AudioAnalyzerDiagnostics {
  lastDeltaMs: number;
  averageDeltaMs: number;
  updateRateHz: number;
}

export type AudioLatencyProbeStatus = 'idle' | 'armed' | 'partial' | 'completed' | 'unavailable';

export interface AudioLatencyProbeMetrics {
  rawMs: number | null;
  smoothedMs: number | null;
  sharedMs: number | null;
  renderMs: number | null;
}

export interface AudioLatencyProbeState {
  status: AudioLatencyProbeStatus;
  note: string;
  sampleCount: number;
  current: AudioLatencyProbeMetrics;
  last: AudioLatencyProbeMetrics;
  average: AudioLatencyProbeMetrics;
}

export interface AudioInputDiagnostics {
  noiseFloor: number;
  peakAmplitude: number;
  dynamicRange: number;
  dynamicRangeDb: number;
  clippingWarning: boolean;
}

export interface AudioAnalyzerState {
  source: AudioAnalyzerSource;
  status: AudioAnalyzerStatus;
  activeInputKind: Exclude<AudioAnalyzerSource, 'manual'> | null;
  errorMessage: string | null;
  rawSignals: AudioSignals;
  signals: AudioSignals;
  spectrumBars: number[];
  spectrogramFrames: number[][];
  diagnostics: AudioAnalyzerDiagnostics;
  latencyProbe: AudioLatencyProbeState;
  inputDiagnostics: AudioInputDiagnostics;
  debugConfig: AudioAnalyzerDebugConfig;
  activeTestMode: AudioAnalyzerTestMode | null;
  updatedAtMs: number | null;
}

type AudioAnalyzerListener = (state: AudioAnalyzerState) => void;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createDefaultAudioSignals(): AudioSignals {
  return {
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    pulse: 0,
  };
}

export function createDefaultAudioAnalyzerDebugConfig(): AudioAnalyzerDebugConfig {
  return {
    attackMs: 65,
    releaseMs: 240,
    pulseDecayMs: 240,
    pulseCooldownMs: 180,
    smoothingBypass: false,
  };
}

export function createDefaultAudioAnalyzerDiagnostics(): AudioAnalyzerDiagnostics {
  return {
    lastDeltaMs: 0,
    averageDeltaMs: 0,
    updateRateHz: 0,
  };
}

export function createEmptyAudioLatencyProbeMetrics(): AudioLatencyProbeMetrics {
  return {
    rawMs: null,
    smoothedMs: null,
    sharedMs: null,
    renderMs: null,
  };
}

function cloneLatencyProbeMetrics(metrics: AudioLatencyProbeMetrics): AudioLatencyProbeMetrics {
  return {
    rawMs: metrics.rawMs === null ? null : Math.max(0, metrics.rawMs),
    smoothedMs: metrics.smoothedMs === null ? null : Math.max(0, metrics.smoothedMs),
    sharedMs: metrics.sharedMs === null ? null : Math.max(0, metrics.sharedMs),
    renderMs: metrics.renderMs === null ? null : Math.max(0, metrics.renderMs),
  };
}

export function createDefaultAudioLatencyProbeState(): AudioLatencyProbeState {
  return {
    status: 'idle',
    note: 'Run the probe while the analyzer is active to estimate internal audio-to-shader timing.',
    sampleCount: 0,
    current: createEmptyAudioLatencyProbeMetrics(),
    last: createEmptyAudioLatencyProbeMetrics(),
    average: createEmptyAudioLatencyProbeMetrics(),
  };
}

export function createDefaultAudioInputDiagnostics(): AudioInputDiagnostics {
  return {
    noiseFloor: 0,
    peakAmplitude: 0,
    dynamicRange: 0,
    dynamicRangeDb: 0,
    clippingWarning: false,
  };
}

export function createDefaultSpectrumBars(): number[] {
  return new Array(AUDIO_ANALYZER_SPECTRUM_BAR_COUNT).fill(0);
}

export function createDefaultSpectrogramFrames(): number[][] {
  return new Array(AUDIO_ANALYZER_SPECTROGRAM_HISTORY_LENGTH)
    .fill(null)
    .map(() => new Array(AUDIO_ANALYZER_SPECTROGRAM_BAND_COUNT).fill(0));
}

function cloneAudioSignals(signals: AudioSignals): AudioSignals {
  return {
    bass: clamp01(signals.bass),
    mid: clamp01(signals.mid),
    treble: clamp01(signals.treble),
    energy: clamp01(signals.energy),
    pulse: clamp01(signals.pulse),
  };
}

function cloneInputDiagnostics(diagnostics: AudioInputDiagnostics): AudioInputDiagnostics {
  return {
    noiseFloor: clamp01(diagnostics.noiseFloor),
    peakAmplitude: clamp01(diagnostics.peakAmplitude),
    dynamicRange: clamp01(diagnostics.dynamicRange),
    dynamicRangeDb: Math.max(0, diagnostics.dynamicRangeDb),
    clippingWarning: Boolean(diagnostics.clippingWarning),
  };
}

function cloneState(state: AudioAnalyzerState): AudioAnalyzerState {
  return {
    ...state,
    rawSignals: cloneAudioSignals(state.rawSignals),
    signals: cloneAudioSignals(state.signals),
    spectrumBars: [...state.spectrumBars],
    spectrogramFrames: state.spectrogramFrames.map((frame) => frame.map((value) => clamp01(value))),
    diagnostics: {
      ...state.diagnostics,
    },
    latencyProbe: {
      ...state.latencyProbe,
      current: cloneLatencyProbeMetrics(state.latencyProbe.current),
      last: cloneLatencyProbeMetrics(state.latencyProbe.last),
      average: cloneLatencyProbeMetrics(state.latencyProbe.average),
    },
    inputDiagnostics: cloneInputDiagnostics(state.inputDiagnostics),
    debugConfig: {
      ...state.debugConfig,
    },
  };
}

export interface AudioAnalyzerStore {
  getState: () => AudioAnalyzerState;
  getAudioSignals: () => AudioSignals;
  subscribe: (listener: AudioAnalyzerListener) => () => void;
  setSource: (source: AudioAnalyzerSource) => void;
  setStatus: (
    status: AudioAnalyzerStatus,
    options?: {
      activeInputKind?: Exclude<AudioAnalyzerSource, 'manual'> | null;
      errorMessage?: string | null;
      activeTestMode?: AudioAnalyzerTestMode | null;
    },
  ) => void;
  setDebugConfig: (patch: Partial<AudioAnalyzerDebugConfig>) => void;
  resetDebugConfig: () => void;
  setAnalysisFrame: (frame: {
    rawSignals: AudioSignals;
    smoothedSignals: AudioSignals;
    spectrumBars: number[];
    spectrogramFrames: number[][];
    diagnostics: AudioAnalyzerDiagnostics;
    inputDiagnostics: AudioInputDiagnostics;
      updatedAtMs?: number | null;
    }) => void;
  setLatencyProbeState: (latencyProbe: AudioLatencyProbeState) => void;
  resetLatencyProbe: () => void;
  resetSignals: () => void;
}

export function createAudioAnalyzerStore(): AudioAnalyzerStore {
  let state: AudioAnalyzerState = {
    source: 'manual',
    status: 'idle',
    activeInputKind: null,
    errorMessage: null,
    rawSignals: createDefaultAudioSignals(),
    signals: createDefaultAudioSignals(),
    spectrumBars: createDefaultSpectrumBars(),
    spectrogramFrames: createDefaultSpectrogramFrames(),
    diagnostics: createDefaultAudioAnalyzerDiagnostics(),
    latencyProbe: createDefaultAudioLatencyProbeState(),
    inputDiagnostics: createDefaultAudioInputDiagnostics(),
    debugConfig: createDefaultAudioAnalyzerDebugConfig(),
    activeTestMode: null,
    updatedAtMs: null,
  };

  const listeners = new Set<AudioAnalyzerListener>();

  const emit = (): void => {
    const snapshot = cloneState(state);
    listeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  return {
    getState: () => cloneState(state),
    getAudioSignals: () => cloneAudioSignals(state.signals),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSource: (source) => {
      state = {
        ...state,
        source,
        activeInputKind: source === 'manual' ? null : state.activeInputKind,
        activeTestMode: source === 'test-generator' ? state.activeTestMode : null,
      };
      emit();
    },
    setStatus: (status, options = {}) => {
      state = {
        ...state,
        status,
        activeInputKind: options.activeInputKind !== undefined ? options.activeInputKind : state.activeInputKind,
        errorMessage: options.errorMessage !== undefined ? options.errorMessage : state.errorMessage,
        activeTestMode: options.activeTestMode !== undefined ? options.activeTestMode : state.activeTestMode,
      };
      emit();
    },
    setDebugConfig: (patch) => {
      state = {
        ...state,
        debugConfig: {
          ...state.debugConfig,
          ...patch,
        },
      };
      emit();
    },
    resetDebugConfig: () => {
      state = {
        ...state,
        debugConfig: createDefaultAudioAnalyzerDebugConfig(),
      };
      emit();
    },
    setAnalysisFrame: ({
      rawSignals,
      smoothedSignals,
      spectrumBars,
      spectrogramFrames,
      diagnostics,
      inputDiagnostics,
      updatedAtMs = null,
    }) => {
      state = {
        ...state,
        rawSignals: cloneAudioSignals(rawSignals),
        signals: cloneAudioSignals(smoothedSignals),
        spectrumBars: spectrumBars.map((value) => clamp01(value)),
        spectrogramFrames: spectrogramFrames.map((frame) => frame.map((value) => clamp01(value))),
        diagnostics: {
          ...diagnostics,
        },
        inputDiagnostics: cloneInputDiagnostics(inputDiagnostics),
        updatedAtMs,
      };
      emit();
    },
    setLatencyProbeState: (latencyProbe) => {
      state = {
        ...state,
        latencyProbe: {
          ...latencyProbe,
          current: cloneLatencyProbeMetrics(latencyProbe.current),
          last: cloneLatencyProbeMetrics(latencyProbe.last),
          average: cloneLatencyProbeMetrics(latencyProbe.average),
        },
      };
      emit();
    },
    resetLatencyProbe: () => {
      state = {
        ...state,
        latencyProbe: createDefaultAudioLatencyProbeState(),
      };
      emit();
    },
    resetSignals: () => {
      state = {
        ...state,
        rawSignals: createDefaultAudioSignals(),
        signals: createDefaultAudioSignals(),
        spectrumBars: createDefaultSpectrumBars(),
        spectrogramFrames: createDefaultSpectrogramFrames(),
        diagnostics: createDefaultAudioAnalyzerDiagnostics(),
        latencyProbe: {
          ...state.latencyProbe,
          current: createEmptyAudioLatencyProbeMetrics(),
        },
        inputDiagnostics: createDefaultAudioInputDiagnostics(),
        updatedAtMs: null,
      };
      emit();
    },
  };
}
