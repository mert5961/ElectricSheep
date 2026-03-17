import {
  AUDIO_ANALYZER_SPECTROGRAM_BAND_COUNT,
  AUDIO_ANALYZER_SPECTROGRAM_HISTORY_LENGTH,
  AUDIO_ANALYZER_SPECTRUM_BAR_COUNT,
  type AudioAnalyzerStore,
  type AudioAnalyzerTestMode,
  type AudioSignals,
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
import { AdaptiveNoiseGate } from './noiseGate.ts';
import { OnsetDetector } from './onsetDetector.ts';
import { PulseDetector } from './pulseDetector.ts';
import { SignalEnricher } from './signalEnricher.ts';

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

  private readonly noiseGate = new AdaptiveNoiseGate();

  private readonly onsetDetector = new OnsetDetector();

  private readonly pulseDetector = new PulseDetector();

  private readonly signalEnricher = new SignalEnricher();

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
      this.signalEnricher.reset();
      this.noiseGate.reset();
      this.onsetDetector.reset();
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
      this.signalEnricher.reset();
      this.noiseGate.reset();
      this.onsetDetector.reset();
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
    this.signalEnricher.reset();
    this.noiseGate.reset();
    this.onsetDetector.reset();
    this.smoothedSignals = createDefaultAudioSignals();
    this.spectrogramHistory = createDefaultSpectrogramFrames();
    this.lastUpdateTimeMs = null;
    this.store.setSource('manual');
    this.store.setStatus('idle', {
      activeInputKind: null,
      errorMessage: null,
      activeTestMode: null,
    });
    this.store.resetSignals();
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

    const rawBands = computeFrequencyBands({
      frequencyData: this.frequencyData,
      sampleRate: this.audioContext.sampleRate,
      fftSize: this.analyserNode.fftSize,
    });
    const rawEnergy = computeWaveformEnergy(this.timeDomainData);
    const inputDiagnostics = computeAudioInputDiagnostics(this.timeDomainData);

    const gated = this.noiseGate.gate(
      rawBands.bass,
      rawBands.mid,
      rawBands.treble,
      rawEnergy,
      deltaTimeMs,
    );
    const energy = computeWaveformEnergy(this.timeDomainData, gated.energyFloor);

    const onsets = this.onsetDetector.update(
      this.frequencyData,
      this.audioContext.sampleRate,
      this.analyserNode.fftSize,
      deltaTimeMs,
    );

    const rawPulse = this.pulseDetector.update({
      bass: gated.bass,
      energy,
      deltaTimeMs,
      decayMs: debugConfig.pulseDecayMs,
      cooldownMs: debugConfig.pulseCooldownMs,
    });

    const enriched = this.signalEnricher.update({
      bass: gated.bass,
      energy,
      frequencyData: this.frequencyData,
      deltaTimeMs,
    });

    const rawSignals: AudioSignals = {
      bass: gated.bass,
      mid: gated.mid,
      treble: gated.treble,
      energy,
      pulse: rawPulse,
      bassSmooth: enriched.bassSmooth,
      hit: enriched.hit,
      flux: enriched.flux,
      rumble: enriched.rumble,
      kick: onsets.kick,
      snare: onsets.snare,
      hihat: onsets.hihat,
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
          bassSmooth: enriched.bassSmooth,
          hit: enriched.hit,
          flux: enriched.flux,
          rumble: enriched.rumble,
          kick: onsets.kick,
          snare: onsets.snare,
          hihat: onsets.hihat,
        };

    this.smoothedSignals = {
      bass: clamp01(nextSignals.bass),
      mid: clamp01(nextSignals.mid),
      treble: clamp01(nextSignals.treble),
      energy: clamp01(nextSignals.energy),
      pulse: clamp01(nextSignals.pulse),
      bassSmooth: clamp01(nextSignals.bassSmooth),
      hit: clamp01(nextSignals.hit),
      flux: clamp01(nextSignals.flux),
      rumble: clamp01(nextSignals.rumble),
      kick: clamp01(nextSignals.kick),
      snare: clamp01(nextSignals.snare),
      hihat: clamp01(nextSignals.hihat),
    };

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
      this.signalEnricher.reset();
      this.noiseGate.reset();
      this.onsetDetector.reset();
      this.smoothedSignals = createDefaultAudioSignals();
      this.spectrogramHistory = createDefaultSpectrogramFrames();
      this.lastUpdateTimeMs = null;

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
      this.signalEnricher.reset();
      this.noiseGate.reset();
      this.onsetDetector.reset();
      this.smoothedSignals = createDefaultAudioSignals();
      this.spectrogramHistory = createDefaultSpectrogramFrames();
      this.lastUpdateTimeMs = null;
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
    analyserNode.smoothingTimeConstant = 0.3;
    return analyserNode;
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
