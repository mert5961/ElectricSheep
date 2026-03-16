import {
  AUDIO_ANALYZER_SPECTROGRAM_BAND_COUNT,
  AUDIO_ANALYZER_SPECTROGRAM_HISTORY_LENGTH,
  AUDIO_ANALYZER_SPECTRUM_BAR_COUNT,
  createDefaultAudioLatencyProbeState,
  type AudioAnalyzerStore,
  type AudioLatencyProbeMetrics,
  type AudioLatencyProbeState,
  type AudioAnalyzerTestMode,
  type AudioSignals,
  createEmptyAudioLatencyProbeMetrics,
  createDefaultSpectrogramFrames,
  createDefaultAudioSignals,
} from './audioAnalyzerStore.ts';
import { createAudioDebugTestHandle } from './debugTestGenerator.ts';
import { computeWaveformEnergy } from './energyDetector.ts';
import {
  computeFrequencyBands,
  computeSpectrumBars,
} from './frequencyBands.ts';
import { computeAudioInputDiagnostics } from './inputDiagnostics.ts';
import { PulseDetector } from './pulseDetector.ts';

type LiveAudioSource = 'microphone' | 'display' | 'test-generator';
type ExternalAudioSource = Exclude<LiveAudioSource, 'test-generator'>;

interface AudioInputHandle {
  kind: LiveAudioSource;
  nodes: AudioNode[];
  stop: () => void;
  testMode?: AudioAnalyzerTestMode | null;
}

interface AudioInputProvider {
  kind: ExternalAudioSource;
  isSupported: () => boolean;
  start: (context: AudioContext, analyserNode: AnalyserNode) => Promise<AudioInputHandle>;
}

interface PendingLatencyProbe {
  triggeredAtMs: number;
  current: AudioLatencyProbeMetrics;
}

const LATENCY_PROBE_THRESHOLD = 0.16;
const LATENCY_PROBE_TIMEOUT_MS = 1200;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothSignal(
  current: number,
  target: number,
  deltaTimeMs: number,
  attackMs: number,
  releaseMs: number,
): number {
  const timeConstantMs = target >= current ? attackMs : releaseMs;
  if (timeConstantMs <= 0) {
    return target;
  }

  const alpha = 1 - Math.exp(-Math.max(8, deltaTimeMs) / timeConstantMs);
  return current + ((target - current) * alpha);
}

function computeLatencyProbeActivation(signals: AudioSignals): number {
  return clamp01(Math.max(
    signals.pulse,
    signals.energy * 0.92,
    signals.bass * 0.88,
    signals.mid * 0.42,
  ));
}

class MicrophoneInputProvider implements AudioInputProvider {
  readonly kind = 'microphone' as const;

  isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  async start(context: AudioContext, analyserNode: AnalyserNode): Promise<AudioInputHandle> {
    if (!this.isSupported()) {
      throw new Error('Microphone capture is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    const sourceNode = context.createMediaStreamSource(stream);
    sourceNode.connect(analyserNode);

    return {
      kind: this.kind,
      nodes: [sourceNode],
      stop: () => {
        stream.getTracks().forEach((track) => track.stop());
      },
    };
  }
}

class DisplayAudioInputProvider implements AudioInputProvider {
  readonly kind = 'display' as const;

  isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && Boolean(navigator.mediaDevices?.getDisplayMedia);
  }

  async start(context: AudioContext, analyserNode: AnalyserNode): Promise<AudioInputHandle> {
    if (!this.isSupported()) {
      throw new Error('Display audio capture is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true,
    });

    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('The selected display source did not expose an audio track.');
    }

    const sourceNode = context.createMediaStreamSource(stream);
    sourceNode.connect(analyserNode);

    return {
      kind: this.kind,
      nodes: [sourceNode],
      stop: () => {
        stream.getTracks().forEach((track) => track.stop());
      },
    };
  }
}

export class AudioAnalyzer {
  private readonly store: AudioAnalyzerStore;

  private readonly pulseDetector = new PulseDetector();

  private readonly microphoneInputProvider = new MicrophoneInputProvider();

  private readonly displayInputProvider = new DisplayAudioInputProvider();

  private readonly fftSize: number;

  private readonly analyserMinDecibels: number;

  private readonly analyserMaxDecibels: number;

  private audioContext: AudioContext | null = null;

  private analyserNode: AnalyserNode | null = null;

  private sourceNodes: AudioNode[] = [];

  private inputHandle: AudioInputHandle | null = null;

  private frequencyData: Uint8Array | null = null;

  private timeDomainData: Uint8Array | null = null;

  private smoothedSignals: AudioSignals = createDefaultAudioSignals();

  private spectrogramHistory: number[][] = createDefaultSpectrogramFrames();

  private lastUpdateTimeMs: number | null = null;

  private latencyProbeState: AudioLatencyProbeState = createDefaultAudioLatencyProbeState();

  private pendingLatencyProbe: PendingLatencyProbe | null = null;

  private latencyProbeSampleCount = 0;

  private latencyProbeTotals = {
    rawMs: 0,
    smoothedMs: 0,
    sharedMs: 0,
    renderMs: 0,
  };

  constructor({
    store,
    fftSize = 2048,
    analyserMinDecibels = -88,
    analyserMaxDecibels = -12,
  }: {
    store: AudioAnalyzerStore;
    fftSize?: number;
    analyserMinDecibels?: number;
    analyserMaxDecibels?: number;
  }) {
    this.store = store;
    this.fftSize = fftSize;
    this.analyserMinDecibels = analyserMinDecibels;
    this.analyserMaxDecibels = analyserMaxDecibels;
  }

  getAudioSignals(): AudioSignals {
    return this.store.getAudioSignals();
  }

  getState() {
    return this.store.getState();
  }

  isRunning(): boolean {
    return this.store.getState().status === 'running' && this.inputHandle !== null;
  }

  supportsDisplayAudio(): boolean {
    return this.displayInputProvider.isSupported();
  }

  async startMicrophone(): Promise<void> {
    await this.startExternalInput(this.microphoneInputProvider);
  }

  async startDisplayAudio(): Promise<void> {
    await this.startExternalInput(this.displayInputProvider);
  }

  async startDebugTest(mode: AudioAnalyzerTestMode): Promise<void> {
    this.store.setStatus('requesting', {
      activeInputKind: 'test-generator',
      errorMessage: null,
      activeTestMode: mode,
    });

    try {
      await this.cleanupNodes();
      this.pulseDetector.reset();
      this.smoothedSignals = createDefaultAudioSignals();
      this.spectrogramHistory = createDefaultSpectrogramFrames();
      this.lastUpdateTimeMs = null;

      const context = await this.ensureAudioContext();
      const analyserNode = this.createAnalyserNode(context);
      const debugHandle = createAudioDebugTestHandle({
        mode,
        context,
        analyserNode,
      });

      this.inputHandle = {
        kind: 'test-generator',
        nodes: debugHandle.nodes,
        stop: debugHandle.stop,
        testMode: mode,
      };
      this.analyserNode = analyserNode;
      this.sourceNodes = debugHandle.nodes;
      this.frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
      this.timeDomainData = new Uint8Array(analyserNode.fftSize);

      this.store.setSource('test-generator');
      this.store.setStatus('running', {
        activeInputKind: 'test-generator',
        errorMessage: null,
        activeTestMode: mode,
      });
      this.store.resetSignals();
    } catch (error) {
      await this.cleanupNodes();
      this.pulseDetector.reset();
      this.smoothedSignals = createDefaultAudioSignals();
      this.spectrogramHistory = createDefaultSpectrogramFrames();
      this.lastUpdateTimeMs = null;
      this.store.setSource('manual');
      this.store.setStatus('error', {
        activeInputKind: null,
        errorMessage: error instanceof Error ? error.message : 'Unable to start the debug test generator.',
        activeTestMode: null,
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.cleanupNodes();
    this.pulseDetector.reset();
    this.smoothedSignals = createDefaultAudioSignals();
    this.spectrogramHistory = createDefaultSpectrogramFrames();
    this.lastUpdateTimeMs = null;
    this.clearPendingLatencyProbe(
      this.latencyProbeSampleCount > 0
        ? 'Probe idle. Previous latency sample is preserved below.'
        : 'Probe idle. Start live analyzer input to measure internal timing.',
    );
    this.store.setSource('manual');
    this.store.setStatus('idle', {
      activeInputKind: null,
      errorMessage: null,
      activeTestMode: null,
    });
    this.store.resetSignals();
  }

  triggerLatencyProbe(): boolean {
    if (!this.audioContext || !this.analyserNode || !this.isRunning()) {
      this.latencyProbeState = {
        ...this.latencyProbeState,
        status: 'unavailable',
        note: 'Start microphone or a debug test first, then run the probe.',
        current: createEmptyAudioLatencyProbeMetrics(),
      };
      this.syncLatencyProbeState();
      return false;
    }

    if (computeLatencyProbeActivation(this.smoothedSignals) > 0.08) {
      this.latencyProbeState = {
        ...this.latencyProbeState,
        status: 'unavailable',
        note: 'The analyzer is already hot. Stop tone tests or wait for a quieter moment before measuring latency.',
        current: createEmptyAudioLatencyProbeMetrics(),
      };
      this.syncLatencyProbeState();
      return false;
    }

    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 96;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0.0001;

    oscillator.connect(gainNode);
    gainNode.connect(this.analyserNode);

    const now = this.audioContext.currentTime;
    const triggerAtMs = performance.now() + 6;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.95, now + 0.006);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };

    this.pendingLatencyProbe = {
      triggeredAtMs: triggerAtMs,
      current: createEmptyAudioLatencyProbeMetrics(),
    };
    this.latencyProbeState = {
      ...this.latencyProbeState,
      status: 'armed',
      note: 'Probe pulse injected. Waiting for raw, smoothed, shared, and render-stage response.',
      current: createEmptyAudioLatencyProbeMetrics(),
    };
    this.syncLatencyProbeState();
    return true;
  }

  resetLatencyProbe(): void {
    this.pendingLatencyProbe = null;
    this.latencyProbeSampleCount = 0;
    this.latencyProbeTotals = {
      rawMs: 0,
      smoothedMs: 0,
      sharedMs: 0,
      renderMs: 0,
    };
    this.latencyProbeState = createDefaultAudioLatencyProbeState();
    this.store.resetLatencyProbe();
  }

  recordLatencyProbeSharedFrame(currentTimeMs: number, signals: AudioSignals): void {
    this.recordLatencyProbeMetric('sharedMs', currentTimeMs, signals);
  }

  recordLatencyProbeRenderSubmission(currentTimeMs: number, signals: AudioSignals): void {
    this.recordLatencyProbeMetric('renderMs', currentTimeMs, signals);
  }

  update(currentTimeMs: number): AudioSignals | null {
    if (!this.analyserNode || !this.frequencyData || !this.timeDomainData || !this.audioContext) {
      return null;
    }

    const deltaTimeMs = this.lastUpdateTimeMs === null
      ? 16.67
      : Math.max(8, currentTimeMs - this.lastUpdateTimeMs);
    this.lastUpdateTimeMs = currentTimeMs;
    const analyzerState = this.store.getState();
    const debugConfig = analyzerState.debugConfig;

    this.analyserNode.getByteFrequencyData(this.frequencyData);
    this.analyserNode.getByteTimeDomainData(this.timeDomainData);

    const bands = computeFrequencyBands({
      frequencyData: this.frequencyData,
      sampleRate: this.audioContext.sampleRate,
      fftSize: this.analyserNode.fftSize,
    });
    const energy = computeWaveformEnergy(this.timeDomainData);
    const inputDiagnostics = computeAudioInputDiagnostics(this.timeDomainData);
    const rawPulse = this.pulseDetector.update({
      bass: bands.bass,
      energy,
      deltaTimeMs,
      decayMs: debugConfig.pulseDecayMs,
      cooldownMs: debugConfig.pulseCooldownMs,
    });

    const rawSignals: AudioSignals = {
      bass: bands.bass,
      mid: bands.mid,
      treble: bands.treble,
      energy,
      pulse: rawPulse,
    };

    const nextSignals: AudioSignals = debugConfig.smoothingBypass
      ? {
          ...rawSignals,
        }
      : {
          bass: smoothSignal(
            this.smoothedSignals.bass,
            rawSignals.bass,
            deltaTimeMs,
            debugConfig.attackMs,
            debugConfig.releaseMs,
          ),
          mid: smoothSignal(
            this.smoothedSignals.mid,
            rawSignals.mid,
            deltaTimeMs,
            debugConfig.attackMs,
            debugConfig.releaseMs,
          ),
          treble: smoothSignal(
            this.smoothedSignals.treble,
            rawSignals.treble,
            deltaTimeMs,
            debugConfig.attackMs,
            debugConfig.releaseMs,
          ),
          energy: smoothSignal(
            this.smoothedSignals.energy,
            rawSignals.energy,
            deltaTimeMs,
            debugConfig.attackMs,
            debugConfig.releaseMs,
          ),
          pulse: Math.max(
            rawSignals.pulse,
            smoothSignal(
              this.smoothedSignals.pulse,
              rawSignals.pulse,
              deltaTimeMs,
              Math.max(8, debugConfig.attackMs * 0.35),
              debugConfig.releaseMs,
            ),
          ),
        };

    this.smoothedSignals = {
      bass: clamp01(nextSignals.bass),
      mid: clamp01(nextSignals.mid),
      treble: clamp01(nextSignals.treble),
      energy: clamp01(nextSignals.energy),
      pulse: clamp01(nextSignals.pulse),
    };
    this.updateLatencyProbeFromAnalyzer(currentTimeMs, rawSignals, this.smoothedSignals);

    const previousAverageDeltaMs = analyzerState.diagnostics.averageDeltaMs;
    const averageDeltaMs = previousAverageDeltaMs > 0
      ? ((previousAverageDeltaMs * 0.88) + (deltaTimeMs * 0.12))
      : deltaTimeMs;
    const spectrumBars = computeSpectrumBars({
      frequencyData: this.frequencyData,
      sampleRate: this.audioContext.sampleRate,
      fftSize: this.analyserNode.fftSize,
      barCount: AUDIO_ANALYZER_SPECTRUM_BAR_COUNT,
    }).bars;
    const spectrogramFrame = computeSpectrumBars({
      frequencyData: this.frequencyData,
      sampleRate: this.audioContext.sampleRate,
      fftSize: this.analyserNode.fftSize,
      barCount: AUDIO_ANALYZER_SPECTROGRAM_BAND_COUNT,
    }).bars;
    this.spectrogramHistory = [
      ...this.spectrogramHistory.slice(-(AUDIO_ANALYZER_SPECTROGRAM_HISTORY_LENGTH - 1)),
      spectrogramFrame,
    ];

    this.store.setAnalysisFrame({
      rawSignals,
      smoothedSignals: this.smoothedSignals,
      spectrumBars,
      spectrogramFrames: this.spectrogramHistory,
      diagnostics: {
        lastDeltaMs: deltaTimeMs,
        averageDeltaMs,
        updateRateHz: averageDeltaMs > 0 ? (1000 / averageDeltaMs) : 0,
      },
      inputDiagnostics,
      updatedAtMs: currentTimeMs,
    });
    return this.store.getAudioSignals();
  }

  private async startExternalInput(provider: AudioInputProvider): Promise<void> {
    this.store.setStatus('requesting', {
      activeInputKind: provider.kind,
      errorMessage: null,
      activeTestMode: null,
    });

    try {
      await this.cleanupNodes();
      this.pulseDetector.reset();
      this.smoothedSignals = createDefaultAudioSignals();
      this.spectrogramHistory = createDefaultSpectrogramFrames();
      this.lastUpdateTimeMs = null;
      this.clearPendingLatencyProbe(
        this.latencyProbeSampleCount > 0
          ? 'Input changed. Previous latency sample is preserved below.'
          : 'Input changed before a latency sample completed.',
      );

      const context = await this.ensureAudioContext();
      const analyserNode = this.createAnalyserNode(context);
      const inputHandle = await provider.start(context, analyserNode);

      this.inputHandle = inputHandle;
      this.analyserNode = analyserNode;
      this.sourceNodes = inputHandle.nodes;
      this.frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
      this.timeDomainData = new Uint8Array(analyserNode.fftSize);

      this.store.setSource(provider.kind);
      this.store.setStatus('running', {
        activeInputKind: provider.kind,
        errorMessage: null,
        activeTestMode: null,
      });
      this.store.resetSignals();
    } catch (error) {
      await this.cleanupNodes();
      this.pulseDetector.reset();
      this.smoothedSignals = createDefaultAudioSignals();
      this.spectrogramHistory = createDefaultSpectrogramFrames();
      this.lastUpdateTimeMs = null;
      this.clearPendingLatencyProbe(
        this.latencyProbeSampleCount > 0
          ? 'Input failed to start. Previous latency sample is preserved below.'
          : 'Input failed before the latency probe could run.',
      );
      this.store.setSource('manual');
      this.store.setStatus('error', {
        activeInputKind: null,
        errorMessage: error instanceof Error ? error.message : 'Unable to start audio analysis.',
        activeTestMode: null,
      });
      throw error;
    }
  }

  private async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new window.AudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  private createAnalyserNode(context: AudioContext): AnalyserNode {
    const analyserNode = context.createAnalyser();
    analyserNode.fftSize = this.fftSize;
    analyserNode.minDecibels = this.analyserMinDecibels;
    analyserNode.maxDecibels = this.analyserMaxDecibels;
    analyserNode.smoothingTimeConstant = 0.18;
    return analyserNode;
  }

  private syncLatencyProbeState(): void {
    this.store.setLatencyProbeState(this.latencyProbeState);
  }

  private buildLatencyProbeAverages(): AudioLatencyProbeMetrics {
    if (this.latencyProbeSampleCount <= 0) {
      return createEmptyAudioLatencyProbeMetrics();
    }

    return {
      rawMs: this.latencyProbeTotals.rawMs / this.latencyProbeSampleCount,
      smoothedMs: this.latencyProbeTotals.smoothedMs / this.latencyProbeSampleCount,
      sharedMs: this.latencyProbeTotals.sharedMs / this.latencyProbeSampleCount,
      renderMs: this.latencyProbeTotals.renderMs / this.latencyProbeSampleCount,
    };
  }

  private clearPendingLatencyProbe(note: string): void {
    this.pendingLatencyProbe = null;
    this.latencyProbeState = {
      ...this.latencyProbeState,
      status: this.latencyProbeSampleCount > 0 ? 'completed' : 'idle',
      note,
      current: createEmptyAudioLatencyProbeMetrics(),
    };
    this.syncLatencyProbeState();
  }

  private finalizeLatencyProbe(status: 'partial' | 'completed', note: string): void {
    if (!this.pendingLatencyProbe) {
      return;
    }

    const metrics = {
      ...this.pendingLatencyProbe.current,
    };
    this.pendingLatencyProbe = null;

    if (status === 'completed') {
      this.latencyProbeSampleCount += 1;
      this.latencyProbeTotals.rawMs += metrics.rawMs || 0;
      this.latencyProbeTotals.smoothedMs += metrics.smoothedMs || 0;
      this.latencyProbeTotals.sharedMs += metrics.sharedMs || 0;
      this.latencyProbeTotals.renderMs += metrics.renderMs || 0;
    }

    this.latencyProbeState = {
      ...this.latencyProbeState,
      status,
      note,
      sampleCount: this.latencyProbeSampleCount,
      current: createEmptyAudioLatencyProbeMetrics(),
      last: metrics,
      average: this.buildLatencyProbeAverages(),
    };
    this.syncLatencyProbeState();
  }

  private updateLatencyProbeFromAnalyzer(
    currentTimeMs: number,
    rawSignals: AudioSignals,
    smoothedSignals: AudioSignals,
  ): void {
    if (!this.pendingLatencyProbe) {
      return;
    }

    if ((currentTimeMs - this.pendingLatencyProbe.triggeredAtMs) > LATENCY_PROBE_TIMEOUT_MS) {
      this.finalizeLatencyProbe(
        'partial',
        'Probe timed out before every stage responded. Try a quieter source or enable smoothing bypass.',
      );
      return;
    }

    this.recordLatencyProbeMetric('rawMs', currentTimeMs, rawSignals);
    this.recordLatencyProbeMetric('smoothedMs', currentTimeMs, smoothedSignals);
  }

  private recordLatencyProbeMetric(
    key: keyof AudioLatencyProbeMetrics,
    currentTimeMs: number,
    signals: AudioSignals,
  ): void {
    if (!this.pendingLatencyProbe) {
      return;
    }

    if (this.pendingLatencyProbe.current[key] !== null || currentTimeMs < this.pendingLatencyProbe.triggeredAtMs) {
      return;
    }

    if (computeLatencyProbeActivation(signals) < LATENCY_PROBE_THRESHOLD) {
      return;
    }

    this.pendingLatencyProbe.current[key] = Math.max(0, currentTimeMs - this.pendingLatencyProbe.triggeredAtMs);
    this.latencyProbeState = {
      ...this.latencyProbeState,
      status: 'partial',
      note: 'Probe is collecting stage timings. Render-stage latency includes CPU-side render submission, not display/projector lag.',
      current: {
        ...this.pendingLatencyProbe.current,
      },
    };
    this.syncLatencyProbeState();

    const metrics = this.pendingLatencyProbe.current;
    const isComplete = metrics.rawMs !== null
      && metrics.smoothedMs !== null
      && metrics.sharedMs !== null
      && metrics.renderMs !== null;
    if (isComplete) {
      this.finalizeLatencyProbe(
        'completed',
        'Probe complete. This is an internal generator-to-shader estimate, not a microphone hardware or projector-light measurement.',
      );
    }
  }

  private async cleanupNodes(): Promise<void> {
    if (this.inputHandle) {
      this.inputHandle.stop();
      this.inputHandle = null;
    }

    this.sourceNodes.forEach((node) => {
      node.disconnect();
    });
    this.sourceNodes = [];

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    this.frequencyData = null;
    this.timeDomainData = null;

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;
  }
}
