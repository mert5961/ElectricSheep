import {
  AUDIO_UNIFORM_SCHEMA,
  FEELING_UNIFORM_SCHEMA,
} from '../contracts/uniforms.ts';
import {
  AUDIO_VISUAL_SIGNAL_DEFINITIONS,
  type AudioVisualSignalUniformKey,
} from '../contracts/audioVisualMapping.ts';
import type {
  ShaderMasterSnapshot,
  UniformSchemaField,
  UniformValueMap,
} from '../contracts/types.ts';
import type { VisualStateRecipe } from '../contracts/visualStateRecipe.ts';
import { listVisualStateRecipes } from '../registry/visualStateRecipes.ts';
import type {
  AudioAnalyzerDebugConfig,
  AudioLatencyProbeState,
  AudioAnalyzerState,
  AudioAnalyzerTestMode,
} from '../../audio-analyzer/audioAnalyzerStore.ts';
import {
  AUDIO_DEBUG_TESTS,
  getAudioDebugTestLabel,
} from '../../audio-analyzer/debugTestGenerator.ts';
import {
  createButton,
  createCardShell,
  createElement,
  createTag,
  setButtonEnabled,
} from './dom.ts';

interface SignalController {
  input: HTMLInputElement;
  valueLabel: HTMLSpanElement;
}

interface MeterController {
  valueLabel: HTMLSpanElement;
  fillEl: HTMLDivElement;
}

interface AnalyzerSignalRowController {
  raw: MeterController;
  smoothed: MeterController;
  shared: MeterController;
}

interface DiagnosticSliderController {
  input: HTMLInputElement;
  valueLabel: HTMLSpanElement;
}

interface AudioVisualSignalController {
  container: HTMLDivElement;
  enableButton: HTMLButtonElement;
  soloButton: HTMLButtonElement;
  sharedValueEl: HTMLSpanElement;
  mappedValueEl: HTMLSpanElement;
  gainInput: HTMLInputElement;
  gainValueEl: HTMLSpanElement;
  thresholdInput: HTMLInputElement;
  thresholdValueEl: HTMLSpanElement;
  curveInput: HTMLInputElement;
  curveValueEl: HTMLSpanElement;
}

const QUICK_RECIPES = listVisualStateRecipes();
const ANALYZER_SIGNAL_ROWS = [
  { key: 'bass', label: 'Bass', uniformKey: 'u_audioBass' },
  { key: 'mid', label: 'Mid', uniformKey: 'u_audioMid' },
  { key: 'treble', label: 'Treble', uniformKey: 'u_audioTreble' },
  { key: 'energy', label: 'Energy', uniformKey: 'u_audioEnergy' },
  { key: 'pulse', label: 'Pulse', uniformKey: 'u_audioPulse' },
] as const;
const ANALYZER_METER_ACCENTS = {
  raw: '#7f8a9a',
  smoothed: '#66d4ff',
  shared: '#87f4b5',
} as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function syncRangeValue(input: HTMLInputElement, nextValue: number): void {
  const serializedValue = nextValue.toFixed(2);
  if (document.activeElement !== input && input.value !== serializedValue) {
    input.value = serializedValue;
  }
}

function syncIntegerRangeValue(input: HTMLInputElement, nextValue: number): void {
  const serializedValue = String(Math.round(nextValue));
  if (document.activeElement !== input && input.value !== serializedValue) {
    input.value = serializedValue;
  }
}

function formatSourceLabel(audioInputState: AudioAnalyzerState | null): string {
  if (!audioInputState) {
    return 'Manual';
  }

  if (audioInputState.source === 'microphone') {
    return 'Microphone Live';
  }

  if (audioInputState.source === 'display') {
    return 'Display Audio';
  }

  if (audioInputState.source === 'test-generator') {
    return 'Debug Generator';
  }

  return 'Manual';
}

function formatStatusLabel(audioInputState: AudioAnalyzerState | null): string {
  if (!audioInputState) {
    return 'idle';
  }

  if (audioInputState.status === 'requesting') {
    return 'requesting input';
  }

  if (audioInputState.status === 'running') {
    return 'running';
  }

  if (audioInputState.status === 'error') {
    return 'error';
  }

  return 'idle';
}

function describeInputQuality(audioInputState: AudioAnalyzerState | null): string {
  const diagnostics = audioInputState?.inputDiagnostics;
  if (!diagnostics) {
    return 'No live analyzer signal yet.';
  }

  if (diagnostics.clippingWarning) {
    return 'Clipping is being detected. Lower the source gain or switch to a cleaner input path.';
  }

  if (diagnostics.noiseFloor > 0.1 && diagnostics.dynamicRangeDb < 12) {
    return 'High floor and low dynamic range suggest noisy or aggressively compressed capture.';
  }

  if (diagnostics.noiseFloor > 0.1) {
    return 'Noise floor looks elevated. Room capture or Bluetooth processing may be coloring the signal.';
  }

  if (diagnostics.dynamicRangeDb < 12) {
    return 'Dynamic range is limited. The source may be compressed even if the spectrum looks correct.';
  }

  return 'Headroom looks reasonable for visual analysis.';
}

function formatLatencyMetric(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(1)} ms`;
}

function formatLatencyProbeStatus(probe: AudioLatencyProbeState | null): string {
  if (!probe) {
    return 'Latency Probe Idle';
  }

  if (probe.status === 'armed') {
    return 'Latency Probe Armed';
  }

  if (probe.status === 'partial') {
    return 'Latency Probe Measuring';
  }

  if (probe.status === 'completed') {
    return 'Latency Probe Complete';
  }

  if (probe.status === 'unavailable') {
    return 'Latency Probe Unavailable';
  }

  return 'Latency Probe Idle';
}

function formatAIUpdateTimestamp(timestampMs: number | null): string {
  if (timestampMs === null) {
    return 'Awaiting first update';
  }

  const secondsAgo = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  return `${new Date(timestampMs).toLocaleTimeString()} • ${secondsAgo}s ago`;
}

function createMeter(accent: string): { element: HTMLDivElement; controller: MeterController } {
  const container = createElement('div', {
    display: 'grid',
    gap: '6px',
    minWidth: '0',
  });
  const valueLabel = createElement('span', {
    fontSize: '11px',
    fontVariantNumeric: 'tabular-nums',
    color: '#edf1f7',
  }, '0.00');
  const track = createElement('div', {
    position: 'relative',
    height: '8px',
    borderRadius: '999px',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.08)',
  });
  const fillEl = createElement('div', {
    width: '0%',
    height: '100%',
    borderRadius: '999px',
    background: accent,
    boxShadow: `0 0 14px ${accent}55`,
  });
  track.append(fillEl);
  container.append(valueLabel, track);
  return {
    element: container,
    controller: {
      valueLabel,
      fillEl,
    },
  };
}

function updateMeter(controller: MeterController, value: number): void {
  const clampedValue = clamp01(value);
  controller.valueLabel.textContent = clampedValue.toFixed(2);
  controller.fillEl.style.width = `${clampedValue * 100}%`;
}

function setButtonActive(
  button: HTMLButtonElement,
  active: boolean,
  accent: string,
): void {
  button.style.borderColor = active ? accent : 'rgba(255,255,255,0.12)';
  button.style.background = active ? `${accent}22` : (button.disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)');
  button.style.color = active ? '#eef6ff' : '#d8dde7';
  button.style.boxShadow = active ? `0 0 0 1px ${accent}33 inset` : 'none';
}

export class DebugSignalsPanel {
  readonly element: HTMLDivElement;

  private readonly audioControllers = new Map<string, SignalController>();

  private readonly feelingControllers = new Map<string, SignalController>();

  private readonly analyzerSignalControllers = new Map<string, AnalyzerSignalRowController>();

  private readonly audioVisualSignalControllers = new Map<AudioVisualSignalUniformKey, AudioVisualSignalController>();

  private readonly analyzerConfigControllers = new Map<keyof AudioAnalyzerDebugConfig, DiagnosticSliderController>();

  private readonly spectrumBars: HTMLDivElement[] = [];

  private readonly testButtons = new Map<AudioAnalyzerTestMode, HTMLButtonElement>();

  private readonly recipeStatusEl: HTMLDivElement;

  private readonly recipeMetaEl: HTMLDivElement;

  private readonly summaryGridEl: HTMLDivElement;

  private readonly aiStatusEl: HTMLDivElement;

  private readonly aiMetaEl: HTMLDivElement;

  private readonly aiStateGridEl: HTMLDivElement;

  private readonly audioVisualSoloStatusEl: HTMLDivElement;

  private readonly analyzerSourceTagEl: HTMLSpanElement;

  private readonly analyzerStatusTagEl: HTMLSpanElement;

  private readonly analyzerModeTagEl: HTMLSpanElement;

  private readonly analyzerMetaEl: HTMLDivElement;

  private readonly analyzerErrorEl: HTMLDivElement;

  private readonly manualAudioMetaEl: HTMLDivElement;

  private readonly feelingMetaEl: HTMLDivElement;

  private readonly diagnosticsDeltaEl: HTMLSpanElement;

  private readonly diagnosticsAverageEl: HTMLSpanElement;

  private readonly diagnosticsRateEl: HTMLSpanElement;

  private readonly latencyProbeStatusEl: HTMLDivElement;

  private readonly latencyProbeMetaEl: HTMLDivElement;

  private readonly latencyProbeSampleCountEl: HTMLSpanElement;

  private readonly latencyProbeLastRawEl: HTMLSpanElement;

  private readonly latencyProbeLastSmoothedEl: HTMLSpanElement;

  private readonly latencyProbeLastSharedEl: HTMLSpanElement;

  private readonly latencyProbeLastRenderEl: HTMLSpanElement;

  private readonly latencyProbeAverageRawEl: HTMLSpanElement;

  private readonly latencyProbeAverageSmoothedEl: HTMLSpanElement;

  private readonly latencyProbeAverageSharedEl: HTMLSpanElement;

  private readonly latencyProbeAverageRenderEl: HTMLSpanElement;

  private readonly inputNoiseFloorEl: HTMLSpanElement;

  private readonly inputPeakEl: HTMLSpanElement;

  private readonly inputDynamicRangeEl: HTMLSpanElement;

  private readonly inputClippingEl: HTMLSpanElement;

  private readonly inputQualityMetaEl: HTMLDivElement;

  private readonly smoothingBypassInput: HTMLInputElement;

  private readonly smoothingBypassValueEl: HTMLSpanElement;

  private readonly manualModeButton: HTMLButtonElement;

  private readonly microphoneButton: HTMLButtonElement;

  private readonly displayAudioButton: HTMLButtonElement;

  private readonly stopTestsButton: HTMLButtonElement;

  private readonly resetAnalyzerDebugButton: HTMLButtonElement;

  private readonly runLatencyProbeButton: HTMLButtonElement;

  private readonly resetLatencyProbeButton: HTMLButtonElement;

  private readonly resetAudioVisualMappingButton: HTMLButtonElement;

  private readonly clearAudioVisualSoloButton: HTMLButtonElement;

  private readonly referencePresetButton: HTMLButtonElement;

  private readonly spectrogramCanvas: HTMLCanvasElement;

  private readonly spectrogramContext: CanvasRenderingContext2D | null;

  private lastSelectedOutputId: string | null = null;

  constructor({
    onSetAudioUniforms,
    onSetFeelingUniforms,
    onResetAudioUniforms,
    onResetFeelingUniforms,
    onResetAllDebugSignals,
    onResetVisualStateRecipeState,
    onApplyVisualStateRecipe,
    onStartMicrophoneAudio,
    onStartDisplayAudio,
    onStartAudioDebugTest,
    onStopAudioAnalyzer,
    onSetAudioAnalyzerDebugConfig,
    onResetAudioAnalyzerDebugConfig,
    onRunAudioLatencyProbe,
    onResetAudioLatencyProbe,
    onSetAudioVisualSignalTuning,
    onSetAudioVisualSoloKey,
    onResetAudioVisualMapping,
    onChangeOutputPreset,
  }: {
    onSetAudioUniforms?: (uniforms: Partial<UniformValueMap>) => void;
    onSetFeelingUniforms?: (uniforms: Partial<UniformValueMap>) => void;
    onResetAudioUniforms?: () => void;
    onResetFeelingUniforms?: () => void;
    onResetAllDebugSignals?: () => void;
    onResetVisualStateRecipeState?: () => void;
    onApplyVisualStateRecipe?: (recipe: VisualStateRecipe) => void;
    onStartMicrophoneAudio?: () => void;
    onStartDisplayAudio?: () => void;
    onStartAudioDebugTest?: (mode: AudioAnalyzerTestMode) => void;
    onStopAudioAnalyzer?: () => void;
    onSetAudioAnalyzerDebugConfig?: (patch: Partial<AudioAnalyzerDebugConfig>) => void;
    onResetAudioAnalyzerDebugConfig?: () => void;
    onRunAudioLatencyProbe?: () => void;
    onResetAudioLatencyProbe?: () => void;
    onSetAudioVisualSignalTuning?: (
      key: AudioVisualSignalUniformKey,
      patch: {
        enabled?: boolean;
        gain?: number;
        threshold?: number;
        curve?: number;
      },
    ) => void;
    onSetAudioVisualSoloKey?: (key: AudioVisualSignalUniformKey | null) => void;
    onResetAudioVisualMapping?: () => void;
    onChangeOutputPreset?: (outputId: string, presetId: string) => void;
  }) {
    this.element = createCardShell(
      'Visual State Recipes',
      'Recipes stay primary for meaningful intent testing. Audio Analyzer diagnostics sit alongside them so we can separate live-input problems from analyzer behavior.',
    );
    Object.assign(this.element.style, {
      minHeight: 'unset',
      gap: '18px',
    });

    const actionRow = createElement('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
    });
    actionRow.append(
      createButton('Reset Audio', () => {
        onResetAudioUniforms?.();
      }),
      createButton('Reset Feelings', () => {
        onResetFeelingUniforms?.();
      }),
      createButton('Clear Recipe', () => {
        onResetVisualStateRecipeState?.();
      }),
      createButton('Reset All', () => {
        onResetAllDebugSignals?.();
      }, {
        borderColor: 'rgba(231, 176, 83, 0.28)',
        color: '#ffe0ad',
      }),
    );

    const quickRow = createElement('div', {
      display: 'grid',
      gap: '10px',
      padding: '14px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
    });
    const quickHeader = createElement('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      flexWrap: 'wrap',
    });
    const quickHeaderCopy = createElement('div', {
      display: 'grid',
      gap: '6px',
      maxWidth: '560px',
    });
    quickHeaderCopy.append(
      createTag('Primary Test States', {
        background: 'rgba(255,255,255,0.08)',
        color: '#d7deea',
      }),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.6',
      }, 'Use recipes to judge full visual choreography. Use the analyzer tools below to diagnose whether shared audio signals are arriving, smoothing, and reaching the bucket cleanly.'),
    );
    const quickHeaderStatus = createElement('div', {
      display: 'grid',
      gap: '4px',
      minWidth: '220px',
    });
    this.recipeStatusEl = createElement('div', {
      fontSize: '12px',
      fontWeight: '600',
      color: '#edf1f7',
    }, 'Manual / Custom');
    this.recipeMetaEl = createElement('div', {
      fontSize: '12px',
      color: '#7f8a9a',
      lineHeight: '1.5',
    }, 'Apply a recipe to drive preset, feeling, expressive controls, and transition timing together.');
    quickHeaderStatus.append(this.recipeStatusEl, this.recipeMetaEl);
    quickHeader.append(quickHeaderCopy, quickHeaderStatus);

    const quickButtons = createElement('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
    });
    QUICK_RECIPES.forEach((recipe) => {
      quickButtons.append(
        createButton(recipe.label, () => {
          onApplyVisualStateRecipe?.(recipe);
        }, {
          background: 'rgba(255,255,255,0.05)',
        }),
      );
    });
    quickRow.append(quickHeader, quickButtons);

    const analyzerCard = createElement('div', {
      display: 'grid',
      gap: '16px',
      padding: '16px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
    });

    const analyzerHeader = createElement('div', {
      display: 'grid',
      gap: '10px',
    });
    const analyzerHeaderTop = createElement('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      flexWrap: 'wrap',
    });
    const analyzerHeaderCopy = createElement('div', {
      display: 'grid',
      gap: '4px',
      maxWidth: '620px',
    });
    analyzerHeaderCopy.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Audio Analyzer Diagnostics'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.6',
      }, 'Raw shows the direct analyzer response. Smoothed shows the analyzer output after attack/release. Shared shows the actual audio bucket that Shader Master receives.'),
    );
    const analyzerStatusWrap = createElement('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'flex-end',
    });
    this.analyzerSourceTagEl = createTag('Source: Manual');
    this.analyzerStatusTagEl = createTag('Status: idle');
    this.analyzerModeTagEl = createTag('Mode: No Test');
    analyzerStatusWrap.append(
      this.analyzerSourceTagEl,
      this.analyzerStatusTagEl,
      this.analyzerModeTagEl,
    );
    analyzerHeaderTop.append(analyzerHeaderCopy, analyzerStatusWrap);
    this.analyzerMetaEl = createElement('div', {
      fontSize: '12px',
      color: '#8a95a6',
      lineHeight: '1.55',
    }, 'Manual mode uses the slider values in the shared bucket. Live/debug modes show analyzer response side-by-side.');
    this.analyzerErrorEl = createElement('div', {
      display: 'none',
      fontSize: '12px',
      lineHeight: '1.5',
      color: '#ffb5b5',
      padding: '10px 12px',
      borderRadius: '12px',
      border: '1px solid rgba(255, 120, 120, 0.22)',
      background: 'rgba(255, 84, 84, 0.08)',
    });
    analyzerHeader.append(analyzerHeaderTop, this.analyzerMetaEl, this.analyzerErrorEl);

    const sourceControls = createElement('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
    });
    this.manualModeButton = createButton('Manual Mode', () => {
      onStopAudioAnalyzer?.();
    });
    this.microphoneButton = createButton('Use Microphone', () => {
      onStartMicrophoneAudio?.();
    });
    this.displayAudioButton = createButton('Display Audio', () => {
      onStartDisplayAudio?.();
    });
    this.stopTestsButton = createButton('Stop Tests', () => {
      onStopAudioAnalyzer?.();
    });
    sourceControls.append(
      this.manualModeButton,
      this.microphoneButton,
      this.displayAudioButton,
      this.stopTestsButton,
    );

    const testGrid = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '12px',
    });
    const groupedTests = new Map<string, typeof AUDIO_DEBUG_TESTS>();
    AUDIO_DEBUG_TESTS.forEach((test) => {
      const entries = groupedTests.get(test.group) || [];
      entries.push(test);
      groupedTests.set(test.group, entries);
    });

    groupedTests.forEach((tests, group) => {
      const groupCard = createElement('div', {
        display: 'grid',
        gap: '10px',
        padding: '12px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.025)',
      });
      groupCard.append(
        createElement('div', {
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#7f8a9a',
        }, group),
      );

      tests.forEach((test) => {
        const testButton = createButton(test.label, () => {
          onStartAudioDebugTest?.(test.id);
        }, {
          justifyContent: 'space-between',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'left',
        });
        const detail = createElement('span', {
          fontSize: '11px',
          color: '#8a95a6',
          fontWeight: '400',
        }, test.description);
        testButton.append(detail);
        this.testButtons.set(test.id, testButton);
        groupCard.append(testButton);
      });

      testGrid.append(groupCard);
    });

    const analyzerMainGrid = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(340px, 1.2fr) minmax(320px, 1fr)',
      gap: '16px',
      alignItems: 'start',
    });

    const responseCard = createElement('div', {
      display: 'grid',
      gap: '10px',
      padding: '14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.025)',
    });
    responseCard.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Signal Response'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, 'Compare direct analyzer output against smoothing and the shared bucket. If Raw is moving but Shared is not, the issue is downstream from the analyzer.'),
    );
    const responseGrid = createElement('div', {
      display: 'grid',
      gridTemplateColumns: '80px repeat(3, minmax(0, 1fr))',
      gap: '10px 12px',
      alignItems: 'center',
    });
    responseGrid.append(
      createElement('div', {
        fontSize: '11px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#657182',
      }, 'Signal'),
      createElement('div', {
        fontSize: '11px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: ANALYZER_METER_ACCENTS.raw,
      }, 'Raw'),
      createElement('div', {
        fontSize: '11px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: ANALYZER_METER_ACCENTS.smoothed,
      }, 'Smoothed'),
      createElement('div', {
        fontSize: '11px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: ANALYZER_METER_ACCENTS.shared,
      }, 'Shared'),
    );
    ANALYZER_SIGNAL_ROWS.forEach((signal) => {
      responseGrid.append(
        createElement('div', {
          fontSize: '12px',
          color: '#edf1f7',
          fontWeight: '600',
        }, signal.label),
      );
      const rawMeter = createMeter(ANALYZER_METER_ACCENTS.raw);
      const smoothedMeter = createMeter(ANALYZER_METER_ACCENTS.smoothed);
      const sharedMeter = createMeter(ANALYZER_METER_ACCENTS.shared);
      responseGrid.append(rawMeter.element, smoothedMeter.element, sharedMeter.element);
      this.analyzerSignalControllers.set(signal.key, {
        raw: rawMeter.controller,
        smoothed: smoothedMeter.controller,
        shared: sharedMeter.controller,
      });
    });
    responseCard.append(responseGrid);

    const diagnosticsColumn = createElement('div', {
      display: 'grid',
      gap: '16px',
    });

    const smoothingCard = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.025)',
    });
    smoothingCard.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Smoothing Diagnostics'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, 'Tune analyzer attack/release and pulse behavior to inspect latency, decay, and whether smoothing is hiding a valid response.'),
    );

    const smoothingFields: Array<{
      key: keyof AudioAnalyzerDebugConfig;
      label: string;
      min: number;
      max: number;
      step: number;
    }> = [
      { key: 'attackMs', label: 'Attack', min: 0, max: 400, step: 1 },
      { key: 'releaseMs', label: 'Release', min: 0, max: 800, step: 1 },
      { key: 'pulseDecayMs', label: 'Pulse Decay', min: 40, max: 800, step: 1 },
      { key: 'pulseCooldownMs', label: 'Pulse Cooldown', min: 0, max: 500, step: 1 },
    ];
    smoothingFields.forEach((field) => {
      const row = createElement('div', {
        display: 'grid',
        gap: '7px',
      });
      const header = createElement('div', {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
      });
      const valueLabel = createElement('span', {
        fontSize: '12px',
        fontVariantNumeric: 'tabular-nums',
        color: '#d7deea',
      }, '0 ms');
      header.append(
        createElement('span', {
          fontSize: '12px',
          color: '#edf1f7',
          fontWeight: '600',
        }, field.label),
        valueLabel,
      );
      const input = createElement('input', {
        width: '100%',
        accentColor: '#66d4ff',
      }) as HTMLInputElement;
      input.type = 'range';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = '0';
      input.addEventListener('input', () => {
        onSetAudioAnalyzerDebugConfig?.({
          [field.key]: Number.parseInt(input.value, 10),
        });
      });
      row.append(header, input);
      smoothingCard.append(row);
      this.analyzerConfigControllers.set(field.key, {
        input,
        valueLabel,
      });
    });

    const bypassRow = createElement('label', {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 12px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
      cursor: 'pointer',
    });
    const bypassCopy = createElement('div', {
      display: 'grid',
      gap: '4px',
    });
    this.smoothingBypassValueEl = createElement('span', {
      fontSize: '11px',
      color: '#8a95a6',
      lineHeight: '1.45',
    }, 'Off');
    bypassCopy.append(
      createElement('span', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#edf1f7',
      }, 'Bypass Smoothing'),
      createElement('span', {
        fontSize: '11px',
        color: '#7f8a9a',
        lineHeight: '1.45',
      }, 'Useful for checking whether slow response comes from smoothing or from the analyzer/input itself.'),
    );
    this.smoothingBypassInput = createElement('input') as HTMLInputElement;
    this.smoothingBypassInput.type = 'checkbox';
    this.smoothingBypassInput.addEventListener('change', () => {
      onSetAudioAnalyzerDebugConfig?.({
        smoothingBypass: this.smoothingBypassInput.checked,
      });
    });
    const bypassMeta = createElement('div', {
      display: 'grid',
      gap: '4px',
      justifyItems: 'end',
      textAlign: 'right',
    });
    bypassMeta.append(this.smoothingBypassValueEl, this.smoothingBypassInput);
    bypassRow.append(bypassCopy, bypassMeta);
    smoothingCard.append(bypassRow);

    this.resetAnalyzerDebugButton = createButton('Reset Analyzer Debug', () => {
      onResetAudioAnalyzerDebugConfig?.();
    });
    smoothingCard.append(this.resetAnalyzerDebugButton);

    const inputQualityCard = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.025)',
    });
    inputQualityCard.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Input Signal Diagnostics'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, 'Use these indicators to tell whether a source is noisy, compressed, or clipping before blaming the analyzer or the shaders.'),
    );
    const inputQualityGrid = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '10px',
    });
    this.inputNoiseFloorEl = this._createDiagnosticValueChip(inputQualityGrid, 'Noise Floor', '0.00');
    this.inputPeakEl = this._createDiagnosticValueChip(inputQualityGrid, 'Peak', '0.00');
    this.inputDynamicRangeEl = this._createDiagnosticValueChip(inputQualityGrid, 'Dynamic Range', '0.0 dB');
    this.inputClippingEl = this._createDiagnosticValueChip(inputQualityGrid, 'Clipping', 'Clean');
    this.inputQualityMetaEl = createElement('div', {
      fontSize: '11px',
      color: '#8a95a6',
      lineHeight: '1.5',
      padding: '10px 12px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.03)',
    }, 'No live analyzer signal yet.');
    inputQualityCard.append(inputQualityGrid, this.inputQualityMetaEl);

    const timingCard = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.025)',
    });
    timingCard.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Timing / Responsiveness'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, 'These are analyzer update timings, useful for spotting stalls or unexpectedly slow response loops.'),
    );
    const timingGrid = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '10px',
    });
    this.diagnosticsDeltaEl = this._createDiagnosticValueChip(timingGrid, 'Last Delta', '0.0 ms');
    this.diagnosticsAverageEl = this._createDiagnosticValueChip(timingGrid, 'Average', '0.0 ms');
    this.diagnosticsRateEl = this._createDiagnosticValueChip(timingGrid, 'Update Rate', '0.0 Hz');
    timingCard.append(timingGrid);

    const latencyProbeCard = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.025)',
    });
    const latencyProbeHeader = createElement('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      flexWrap: 'wrap',
    });
    const latencyProbeCopy = createElement('div', {
      display: 'grid',
      gap: '4px',
      maxWidth: '420px',
    });
    latencyProbeCopy.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Latency Probe'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, 'Injects a one-shot internal pulse into the live analyzer path and measures when it appears in raw analysis, smoothed output, the shared bucket, and the render submission stage.'),
    );
    const latencyProbeStatus = createElement('div', {
      display: 'grid',
      gap: '4px',
      minWidth: '190px',
    });
    this.latencyProbeStatusEl = createElement('div', {
      fontSize: '12px',
      fontWeight: '600',
      color: '#edf1f7',
    }, 'Latency Probe Idle');
    this.latencyProbeMetaEl = createElement('div', {
      fontSize: '11px',
      color: '#8a95a6',
      lineHeight: '1.5',
    }, 'Run the probe while the analyzer is active to estimate internal audio-to-shader timing.');
    latencyProbeStatus.append(this.latencyProbeStatusEl, this.latencyProbeMetaEl);
    latencyProbeHeader.append(latencyProbeCopy, latencyProbeStatus);

    const latencyProbeActions = createElement('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
    });
    this.runLatencyProbeButton = createButton('Run Latency Probe', () => {
      onRunAudioLatencyProbe?.();
    });
    this.resetLatencyProbeButton = createButton('Clear Probe', () => {
      onResetAudioLatencyProbe?.();
    });
    latencyProbeActions.append(this.runLatencyProbeButton, this.resetLatencyProbeButton);

    const latencyProbeGrid = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: '10px',
    });
    this.latencyProbeLastRawEl = this._createDiagnosticValueChip(latencyProbeGrid, 'Last Raw', '--');
    this.latencyProbeLastSmoothedEl = this._createDiagnosticValueChip(latencyProbeGrid, 'Last Smoothed', '--');
    this.latencyProbeLastSharedEl = this._createDiagnosticValueChip(latencyProbeGrid, 'Last Shared', '--');
    this.latencyProbeLastRenderEl = this._createDiagnosticValueChip(latencyProbeGrid, 'Last Render', '--');

    const latencyProbeAverageGrid = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: '10px',
    });
    this.latencyProbeAverageRawEl = this._createDiagnosticValueChip(latencyProbeAverageGrid, 'Avg Raw', '--');
    this.latencyProbeAverageSmoothedEl = this._createDiagnosticValueChip(latencyProbeAverageGrid, 'Avg Smoothed', '--');
    this.latencyProbeAverageSharedEl = this._createDiagnosticValueChip(latencyProbeAverageGrid, 'Avg Shared', '--');
    this.latencyProbeAverageRenderEl = this._createDiagnosticValueChip(latencyProbeAverageGrid, 'Avg Render', '--');

    const latencyProbeFooter = createElement('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      padding: '10px 12px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.03)',
    });
    this.latencyProbeSampleCountEl = createElement('span', {
      fontSize: '11px',
      fontWeight: '600',
      color: '#d7deea',
    }, 'Samples: 0');
    latencyProbeFooter.append(
      this.latencyProbeSampleCountEl,
      createElement('span', {
        fontSize: '11px',
        color: '#7f8a9a',
        lineHeight: '1.5',
      }, 'Render timing stops at CPU-side shader submission. It does not include projector or display-panel lag.'),
    );

    latencyProbeCard.append(
      latencyProbeHeader,
      latencyProbeActions,
      latencyProbeGrid,
      latencyProbeAverageGrid,
      latencyProbeFooter,
    );

    diagnosticsColumn.append(smoothingCard, inputQualityCard, timingCard, latencyProbeCard);
    analyzerMainGrid.append(responseCard, diagnosticsColumn);

    const frequencyViews = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: '16px',
      alignItems: 'start',
    });

    const spectrumCard = createElement('div', {
      display: 'grid',
      gap: '10px',
      padding: '14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.025)',
    });
    spectrumCard.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Live Spectrum'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, 'A compact FFT view for spotting where energy sits. Sweeps should travel left-to-right, bass tones should stack on the left, and bright treble should cluster toward the right.'),
    );
    const spectrumWrap = createElement('div', {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '4px',
      height: '92px',
      padding: '10px 8px 6px',
      borderRadius: '12px',
      background: 'rgba(8, 10, 14, 0.72)',
      border: '1px solid rgba(255,255,255,0.06)',
    });
    for (let index = 0; index < 32; index += 1) {
      const bar = createElement('div', {
        flex: '1',
        minWidth: '0',
        height: '4px',
        borderRadius: '999px 999px 3px 3px',
        background: 'linear-gradient(180deg, rgba(102,212,255,0.98) 0%, rgba(117,246,178,0.82) 100%)',
        boxShadow: '0 0 10px rgba(102,212,255,0.18)',
        transition: 'height 0.08s ease',
      });
      spectrumWrap.append(bar);
      this.spectrumBars.push(bar);
    }
    spectrumCard.append(spectrumWrap);

    const spectrogramCard = createElement('div', {
      display: 'grid',
      gap: '10px',
      padding: '14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.025)',
    });
    spectrogramCard.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Scrolling Spectrogram'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, 'Time scrolls left to right. Frequency runs bottom to top. Bright streaks show where energy persists over time, which makes source coloration and band handoffs much easier to read.'),
    );
    this.spectrogramCanvas = createElement('canvas', {
      display: 'block',
      width: '100%',
      height: '112px',
      borderRadius: '12px',
      background: 'rgba(8, 10, 14, 0.88)',
      border: '1px solid rgba(255,255,255,0.06)',
    }) as HTMLCanvasElement;
    this.spectrogramCanvas.width = 320;
    this.spectrogramCanvas.height = 112;
    this.spectrogramContext = this.spectrogramCanvas.getContext('2d');
    spectrogramCard.append(this.spectrogramCanvas);

    frequencyViews.append(spectrumCard, spectrogramCard);

    analyzerCard.append(
      analyzerHeader,
      sourceControls,
      testGrid,
      analyzerMainGrid,
      frequencyViews,
    );

    const audioVisualCard = createElement('div', {
      display: 'grid',
      gap: '14px',
      padding: '16px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
    });
    const audioVisualHeader = createElement('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      flexWrap: 'wrap',
    });
    const audioVisualCopy = createElement('div', {
      display: 'grid',
      gap: '5px',
      maxWidth: '720px',
    });
    audioVisualCopy.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Audio Visual Mapping'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.6',
      }, 'This layer reshapes the shared audio bucket before presets render. Use it to solo one signal, reduce overlap, and suppress low-level noise without changing the analyzer itself.'),
      createElement('div', {
        fontSize: '11px',
        color: '#8a95a6',
        lineHeight: '1.5',
      }, 'For a clean music-following check, switch the selected output to the Audio Reference preset and tune from there.'),
    );
    const audioVisualActions = createElement('div', {
      display: 'grid',
      gap: '8px',
      minWidth: '240px',
      justifyItems: 'end',
    });
    this.audioVisualSoloStatusEl = createElement('div', {
      fontSize: '12px',
      color: '#edf1f7',
      fontWeight: '600',
      textAlign: 'right',
    }, 'Solo: All Signals');
    const audioVisualButtons = createElement('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'flex-end',
    });
    this.clearAudioVisualSoloButton = createButton('All Signals', () => {
      onSetAudioVisualSoloKey?.(null);
    });
    this.resetAudioVisualMappingButton = createButton('Reset Mapping', () => {
      onResetAudioVisualMapping?.();
    });
    this.referencePresetButton = createButton('Use Audio Reference', () => {
      if (!this.lastSelectedOutputId) {
        return;
      }

      onChangeOutputPreset?.(this.lastSelectedOutputId, 'audio-reference');
    });
    audioVisualButtons.append(
      this.clearAudioVisualSoloButton,
      this.resetAudioVisualMappingButton,
      this.referencePresetButton,
    );
    audioVisualActions.append(this.audioVisualSoloStatusEl, audioVisualButtons);
    audioVisualHeader.append(audioVisualCopy, audioVisualActions);

    const audioVisualRows = createElement('div', {
      display: 'grid',
      gap: '12px',
    });
    AUDIO_VISUAL_SIGNAL_DEFINITIONS.forEach((definition) => {
      const row = createElement('div', {
        display: 'grid',
        gap: '10px',
        padding: '12px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.025)',
      });
      const rowHeader = createElement('div', {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        flexWrap: 'wrap',
      });
      const rowCopy = createElement('div', {
        display: 'grid',
        gap: '4px',
      });
      rowCopy.append(
        createElement('div', {
          fontSize: '12px',
          fontWeight: '600',
          color: '#edf1f7',
        }, definition.label),
        createElement('div', {
          fontSize: '11px',
          color: '#8a95a6',
          lineHeight: '1.45',
        }, definition.role),
      );
      const rowMeta = createElement('div', {
        display: 'grid',
        gap: '6px',
        justifyItems: 'end',
      });
      const valuePair = createElement('div', {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      });
      const sharedValueEl = createTag('Shared 0.00');
      const mappedValueEl = createTag('Mapped 0.00', {
        background: 'rgba(102,212,255,0.08)',
        color: '#d9f5ff',
      });
      valuePair.append(sharedValueEl, mappedValueEl);
      const controlButtons = createElement('div', {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      });
      const enableButton = createButton('Enabled', () => {
        const controller = this.audioVisualSignalControllers.get(definition.key);
        const isEnabled = controller ? controller.enableButton.dataset.enabled === 'true' : true;
        onSetAudioVisualSignalTuning?.(definition.key, {
          enabled: !isEnabled,
        });
      });
      const soloButton = createButton('Solo', () => {
        const controller = this.audioVisualSignalControllers.get(definition.key);
        const isSoloActive = controller ? controller.soloButton.dataset.active === 'true' : false;
        onSetAudioVisualSoloKey?.(isSoloActive ? null : definition.key);
      });
      controlButtons.append(enableButton, soloButton);
      rowMeta.append(valuePair, controlButtons);
      rowHeader.append(rowCopy, rowMeta);

      const sliderGrid = createElement('div', {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '10px',
      });
      const gainControl = this._createAudioVisualSlider({
        label: 'Gain',
        min: 0,
        max: 2,
        step: 0.01,
        accentColor: '#66d4ff',
        onInput: (value) => {
          onSetAudioVisualSignalTuning?.(definition.key, {
            gain: value,
          });
        },
      });
      const thresholdControl = this._createAudioVisualSlider({
        label: 'Threshold',
        min: 0,
        max: 0.6,
        step: 0.01,
        accentColor: '#f2a756',
        onInput: (value) => {
          onSetAudioVisualSignalTuning?.(definition.key, {
            threshold: value,
          });
        },
      });
      const curveControl = this._createAudioVisualSlider({
        label: 'Curve',
        min: 0.35,
        max: 3,
        step: 0.01,
        accentColor: '#87f4b5',
        onInput: (value) => {
          onSetAudioVisualSignalTuning?.(definition.key, {
            curve: value,
          });
        },
      });
      sliderGrid.append(gainControl.element, thresholdControl.element, curveControl.element);
      row.append(rowHeader, sliderGrid);
      audioVisualRows.append(row);
      this.audioVisualSignalControllers.set(definition.key, {
        container: row,
        enableButton,
        soloButton,
        sharedValueEl,
        mappedValueEl,
        gainInput: gainControl.input,
        gainValueEl: gainControl.valueLabel,
        thresholdInput: thresholdControl.input,
        thresholdValueEl: thresholdControl.valueLabel,
        curveInput: curveControl.input,
        curveValueEl: curveControl.valueLabel,
      });
    });
    audioVisualCard.append(audioVisualHeader, audioVisualRows);

    const sections = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(280px, 0.9fr)',
      gap: '16px',
      alignItems: 'start',
    });

    const audioSection = this._createSignalSection(
      'Audio',
      'Manual shared audio values. When live input or a debug generator is active, these sliders become read-only so you can compare them against the analyzer-driven bucket.',
      AUDIO_UNIFORM_SCHEMA,
      this.audioControllers,
      (uniforms) => {
        onSetAudioUniforms?.(uniforms);
      },
    );
    this.manualAudioMetaEl = createElement('div', {
      fontSize: '11px',
      color: '#7f8a9a',
      lineHeight: '1.5',
    }, 'Manual mode is active.');
    audioSection.append(this.manualAudioMetaEl);

    const feelingSection = this._createSignalSection(
      'Feeling',
      'Global feeling values feeding feeling-sourced uniforms. When AI is active, these controls become read-only mirrors of the effective feeling layer.',
      FEELING_UNIFORM_SCHEMA,
      this.feelingControllers,
      (uniforms) => {
        onSetFeelingUniforms?.(uniforms);
      },
    );
    this.feelingMetaEl = createElement('div', {
      fontSize: '11px',
      color: '#7f8a9a',
      lineHeight: '1.5',
    }, 'Manual feeling mode is active.');
    feelingSection.append(this.feelingMetaEl);

    sections.append(
      audioSection,
      feelingSection,
    );

    const aiCard = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
      minHeight: '100%',
    });
    this.aiStatusEl = createElement('div', {
      fontSize: '12px',
      fontWeight: '600',
      color: '#d7deea',
    }, 'AI Layer');
    this.aiMetaEl = createElement('div', {
      fontSize: '12px',
      color: '#7f8a9a',
      lineHeight: '1.6',
    }, 'The local Ollama layer updates slowly and only steers macro visual mood controls.');
    this.aiStateGridEl = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '8px',
    });
    aiCard.append(this.aiStatusEl, this.aiMetaEl, this.aiStateGridEl);

    const summaryCard = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
      minHeight: '100%',
    });
    summaryCard.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Active Shared Signals'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.6',
      }, 'These are the effective buckets feeding Shader Master right now. Audio reflects the post-mapping values after solo/gain/threshold/curve tuning, and feeling reflects the AI-adjusted layer when AI is enabled.'),
    );
    this.summaryGridEl = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '8px',
    });
    summaryCard.append(this.summaryGridEl);
    sections.append(aiCard, summaryCard);

    this.element.append(actionRow, quickRow, analyzerCard, audioVisualCard, sections);
  }

  update(state: ShaderMasterSnapshot, audioInputState: AudioAnalyzerState | null = null): void {
    this.lastSelectedOutputId = state.selectedOutputId;
    this._updateRecipeStatus(state);
    this._updateAudioAnalyzerState(state, audioInputState);
    this._updateAudioVisualMapping(state);
    this._updateAIState(state);
    this._updateControllers(this.audioControllers, AUDIO_UNIFORM_SCHEMA, state.audioUniforms);
    this._updateControllers(this.feelingControllers, FEELING_UNIFORM_SCHEMA, state.effectiveFeelingUniforms);
    this._syncFeelingControls(state);
    this._updateSummary(state);
  }

  private _createSignalSection(
    title: string,
    description: string,
    fields: UniformSchemaField[],
    controllerMap: Map<string, SignalController>,
    onChange: (uniforms: Partial<UniformValueMap>) => void,
  ): HTMLDivElement {
    const section = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
    });
    const header = createElement('div', {
      display: 'grid',
      gap: '4px',
    });
    header.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, title),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, description),
    );
    section.append(header);

    fields.forEach((field) => {
      const row = createElement('div', {
        display: 'grid',
        gap: '8px',
      });
      const rowHeader = createElement('div', {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
      });
      const valueLabel = createElement('span', {
        fontSize: '12px',
        fontVariantNumeric: 'tabular-nums',
        color: '#d7deea',
      }, '0.00');

      rowHeader.append(
        createElement('span', {
          fontSize: '13px',
          color: '#edf1f7',
          fontWeight: '600',
        }, field.label),
        valueLabel,
      );

      const input = createElement('input', {
        width: '100%',
        accentColor: field.source === 'audio' ? '#66d4ff' : '#ffb454',
      }) as HTMLInputElement;
      input.type = 'range';
      input.min = String(field.min ?? 0);
      input.max = String(field.max ?? 1);
      input.step = String(field.step ?? 0.01);
      input.value = Number(field.defaultValue).toFixed(2);
      input.addEventListener('input', () => {
        const nextValue = Number.parseFloat(input.value);
        valueLabel.textContent = nextValue.toFixed(2);
        onChange({
          [field.key]: nextValue,
        });
      });

      row.append(rowHeader, input);
      section.append(row);
      controllerMap.set(field.key, {
        input,
        valueLabel,
      });
    });

    return section;
  }

  private _createAudioVisualSlider({
    label,
    min,
    max,
    step,
    accentColor,
    onInput,
  }: {
    label: string;
    min: number;
    max: number;
    step: number;
    accentColor: string;
    onInput: (value: number) => void;
  }): {
    element: HTMLDivElement;
    input: HTMLInputElement;
    valueLabel: HTMLSpanElement;
  } {
    const element = createElement('div', {
      display: 'grid',
      gap: '7px',
    });
    const header = createElement('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '10px',
    });
    const valueLabel = createElement('span', {
      fontSize: '11px',
      color: '#d7deea',
      fontVariantNumeric: 'tabular-nums',
    }, '0.00');
    header.append(
      createElement('span', {
        fontSize: '11px',
        color: '#8a95a6',
      }, label),
      valueLabel,
    );
    const input = createElement('input', {
      width: '100%',
      accentColor,
    }) as HTMLInputElement;
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = '0';
    input.addEventListener('input', () => {
      onInput(Number.parseFloat(input.value));
    });
    element.append(header, input);
    return {
      element,
      input,
      valueLabel,
    };
  }

  private _createDiagnosticValueChip(
    container: HTMLDivElement,
    label: string,
    initialValue: string,
  ): HTMLSpanElement {
    const chip = createElement('div', {
      display: 'grid',
      gap: '4px',
      padding: '10px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.03)',
    });
    const valueEl = createElement('span', {
      fontSize: '12px',
      fontWeight: '600',
      color: '#edf1f7',
      fontVariantNumeric: 'tabular-nums',
    }, initialValue);
    chip.append(
      createElement('span', {
        fontSize: '11px',
        color: '#7f8a9a',
      }, label),
      valueEl,
    );
    container.append(chip);
    return valueEl;
  }

  private _updateAudioVisualMapping(state: ShaderMasterSnapshot): void {
    const mapping = state.audioVisualMapping;
    const selectedOutput = state.outputs.find((output) => output.id === state.selectedOutputId) || null;
    const activeSoloDefinition = AUDIO_VISUAL_SIGNAL_DEFINITIONS.find((definition) => definition.key === mapping.soloKey) || null;
    this.audioVisualSoloStatusEl.textContent = activeSoloDefinition
      ? `Solo: ${activeSoloDefinition.label}`
      : 'Solo: All Signals';

    setButtonActive(this.clearAudioVisualSoloButton, mapping.soloKey === null, '#87f4b5');
    setButtonEnabled(this.referencePresetButton, Boolean(this.lastSelectedOutputId));
    setButtonActive(this.referencePresetButton, selectedOutput?.presetId === 'audio-reference', '#f2a756');

    AUDIO_VISUAL_SIGNAL_DEFINITIONS.forEach((definition) => {
      const controller = this.audioVisualSignalControllers.get(definition.key);
      const tuning = mapping.signals[definition.key];
      if (!controller || !tuning) {
        return;
      }

      const sharedValue = typeof state.audioUniforms[definition.key] === 'number'
        ? state.audioUniforms[definition.key] as number
        : 0;
      const mappedValue = typeof state.mappedAudioUniforms[definition.key] === 'number'
        ? state.mappedAudioUniforms[definition.key] as number
        : 0;
      const isSoloActive = mapping.soloKey === definition.key;
      const isSoloFiltered = mapping.soloKey !== null && mapping.soloKey !== definition.key;
      const isEnabled = tuning.enabled;

      controller.sharedValueEl.textContent = `Shared ${sharedValue.toFixed(2)}`;
      controller.mappedValueEl.textContent = `Mapped ${mappedValue.toFixed(2)}`;

      controller.enableButton.dataset.enabled = isEnabled ? 'true' : 'false';
      controller.enableButton.textContent = isEnabled ? 'Enabled' : 'Muted';
      setButtonActive(controller.enableButton, isEnabled, '#87f4b5');
      controller.soloButton.dataset.active = isSoloActive ? 'true' : 'false';
      setButtonActive(controller.soloButton, isSoloActive, '#66d4ff');

      controller.container.style.opacity = isEnabled
        ? (isSoloFiltered ? '0.45' : '1')
        : '0.58';
      controller.container.style.borderColor = isSoloActive
        ? 'rgba(102,212,255,0.34)'
        : 'rgba(255,255,255,0.08)';

      syncRangeValue(controller.gainInput, tuning.gain);
      controller.gainValueEl.textContent = tuning.gain.toFixed(2);
      syncRangeValue(controller.thresholdInput, tuning.threshold);
      controller.thresholdValueEl.textContent = tuning.threshold.toFixed(2);
      syncRangeValue(controller.curveInput, tuning.curve);
      controller.curveValueEl.textContent = tuning.curve.toFixed(2);
    });
  }

  private _updateRecipeStatus(state: ShaderMasterSnapshot): void {
    const activeTransition = state.visualState.transition;
    const activeState = activeTransition ? state.visualState.target : state.visualState.current;

    if (!activeState) {
      this.recipeStatusEl.textContent = 'Manual / Custom';
      this.recipeMetaEl.textContent = 'Apply a recipe to drive preset, feeling, expressive controls, and transition timing together.';
      return;
    }

    const output = state.outputs.find((entry) => entry.id === activeState.outputId) || null;
    const preset = state.presets.find((entry) => entry.id === activeState.presetId) || null;

    if (activeTransition) {
      const progress = activeTransition.durationMs > 0
        ? Math.min(1, activeTransition.elapsedMs / activeTransition.durationMs)
        : 1;
      this.recipeStatusEl.textContent = `Transitioning to ${activeState.recipeLabel}`;
      this.recipeMetaEl.textContent = [
        `${Math.round(progress * 100)}%`,
        `${activeTransition.durationMs} ms`,
        output?.name || activeState.outputId,
        preset?.label || activeState.presetId,
      ].join(' • ');
      return;
    }

    this.recipeStatusEl.textContent = `Active Recipe: ${activeState.recipeLabel}`;
    this.recipeMetaEl.textContent = [
      output?.name || activeState.outputId,
      preset?.label || activeState.presetId,
      'settled',
    ].join(' • ');
  }

  private _updateAudioAnalyzerState(
    state: ShaderMasterSnapshot,
    audioInputState: AudioAnalyzerState | null,
  ): void {
    this.analyzerSourceTagEl.textContent = `Source: ${formatSourceLabel(audioInputState)}`;
    this.analyzerStatusTagEl.textContent = `Status: ${formatStatusLabel(audioInputState)}`;
    this.analyzerModeTagEl.textContent = `Mode: ${getAudioDebugTestLabel(audioInputState?.activeTestMode || null)}`;

    const isManualSource = !audioInputState || audioInputState.source === 'manual';
    const hasActiveTest = audioInputState?.source === 'test-generator';
    const hasError = Boolean(audioInputState?.errorMessage);

    this.analyzerMetaEl.textContent = isManualSource
      ? 'Manual mode: sliders write directly into the shared audio bucket. Raw and Smoothed stay near zero because the analyzer is not currently driving the signal.'
      : hasActiveTest
        ? 'Debug generator mode: the internal test source is feeding the analyzer path so you can inspect band coverage, smoothing, and bucket response without microphone coloration.'
        : 'Microphone live mode: compare spectrum, raw response, and shared bucket values to judge input coloration and analyzer responsiveness.';

    this.analyzerErrorEl.textContent = audioInputState?.errorMessage || '';
    this.analyzerErrorEl.style.display = hasError ? 'block' : 'none';

    setButtonEnabled(this.manualModeButton, !isManualSource);
    setButtonEnabled(this.microphoneButton, Boolean(audioInputState ? audioInputState.status !== 'requesting' : true));
    setButtonEnabled(this.displayAudioButton, Boolean(audioInputState ? audioInputState.status !== 'requesting' : true));
    setButtonEnabled(this.stopTestsButton, hasActiveTest);
    setButtonActive(this.manualModeButton, isManualSource, '#87f4b5');
    setButtonActive(this.microphoneButton, audioInputState?.source === 'microphone', '#66d4ff');
    setButtonActive(this.displayAudioButton, audioInputState?.source === 'display', '#c98aff');
    setButtonActive(this.stopTestsButton, hasActiveTest, '#f2a756');

    this.testButtons.forEach((button, mode) => {
      const active = audioInputState?.source === 'test-generator' && audioInputState.activeTestMode === mode;
      setButtonActive(button, active, '#66d4ff');
      setButtonEnabled(button, audioInputState?.status !== 'requesting');
    });

    const rawSignals = audioInputState?.rawSignals;
    const smoothedSignals = audioInputState?.signals;
    ANALYZER_SIGNAL_ROWS.forEach((signal) => {
      const row = this.analyzerSignalControllers.get(signal.key);
      if (!row) {
        return;
      }

      const rawValue = rawSignals ? rawSignals[signal.key] : 0;
      const smoothedValue = smoothedSignals ? smoothedSignals[signal.key] : 0;
      const sharedValue = typeof state.audioUniforms[signal.uniformKey] === 'number'
        ? state.audioUniforms[signal.uniformKey] as number
        : 0;
      updateMeter(row.raw, rawValue);
      updateMeter(row.smoothed, smoothedValue);
      updateMeter(row.shared, sharedValue);
    });

    const audioSectionIsLive = !isManualSource;
    this.audioControllers.forEach((controller) => {
      controller.input.disabled = audioSectionIsLive;
      controller.input.style.opacity = audioSectionIsLive ? '0.6' : '1';
      controller.input.style.cursor = audioSectionIsLive ? 'not-allowed' : 'pointer';
    });
    this.manualAudioMetaEl.textContent = audioSectionIsLive
      ? 'Analyzer owns the shared audio bucket right now, so these sliders are read-only mirrors of the shared values.'
      : 'Manual mode is active.';

    const config = audioInputState?.debugConfig;
    if (config) {
      this._syncDiagnosticConfig(config);
    }

    this.diagnosticsDeltaEl.textContent = `${(audioInputState?.diagnostics.lastDeltaMs || 0).toFixed(1)} ms`;
    this.diagnosticsAverageEl.textContent = `${(audioInputState?.diagnostics.averageDeltaMs || 0).toFixed(1)} ms`;
    this.diagnosticsRateEl.textContent = `${(audioInputState?.diagnostics.updateRateHz || 0).toFixed(1)} Hz`;
    this.inputNoiseFloorEl.textContent = `${(audioInputState?.inputDiagnostics.noiseFloor || 0).toFixed(2)}`;
    this.inputPeakEl.textContent = `${(audioInputState?.inputDiagnostics.peakAmplitude || 0).toFixed(2)}`;
    this.inputDynamicRangeEl.textContent = `${(audioInputState?.inputDiagnostics.dynamicRangeDb || 0).toFixed(1)} dB`;
    this.inputClippingEl.textContent = audioInputState?.inputDiagnostics.clippingWarning ? 'Warning' : 'Clean';
    this.inputClippingEl.style.color = audioInputState?.inputDiagnostics.clippingWarning ? '#ffb5b5' : '#87f4b5';
    this.inputQualityMetaEl.textContent = describeInputQuality(audioInputState);
    this._updateLatencyProbe(audioInputState?.latencyProbe || null, audioSectionIsLive);

    const spectrumValues = audioInputState?.spectrumBars || [];
    this.spectrumBars.forEach((bar, index) => {
      const value = clamp01(spectrumValues[index] || 0);
      bar.style.height = `${Math.max(4, value * 100)}%`;
      bar.style.opacity = value > 0.02 ? '1' : '0.35';
    });

    this._renderSpectrogram(audioInputState?.spectrogramFrames || []);
  }

  private _syncDiagnosticConfig(config: AudioAnalyzerDebugConfig): void {
    const rangedKeys: Array<keyof AudioAnalyzerDebugConfig> = [
      'attackMs',
      'releaseMs',
      'pulseDecayMs',
      'pulseCooldownMs',
    ];

    rangedKeys.forEach((key) => {
      const controller = this.analyzerConfigControllers.get(key);
      if (!controller) {
        return;
      }

      const nextValue = Number(config[key]);
      syncIntegerRangeValue(controller.input, nextValue);
      controller.valueLabel.textContent = `${Math.round(nextValue)} ms`;
    });

    this.smoothingBypassInput.checked = config.smoothingBypass;
    this.smoothingBypassValueEl.textContent = config.smoothingBypass ? 'On' : 'Off';
  }

  private _updateLatencyProbe(
    latencyProbe: AudioLatencyProbeState | null,
    analyzerIsLive: boolean,
  ): void {
    this.latencyProbeStatusEl.textContent = formatLatencyProbeStatus(latencyProbe);
    this.latencyProbeMetaEl.textContent = latencyProbe?.note
      || 'Run the probe while the analyzer is active to estimate internal audio-to-shader timing.';
    this.latencyProbeSampleCountEl.textContent = `Samples: ${latencyProbe?.sampleCount || 0}`;

    this.latencyProbeLastRawEl.textContent = formatLatencyMetric(latencyProbe?.last.rawMs ?? null);
    this.latencyProbeLastSmoothedEl.textContent = formatLatencyMetric(latencyProbe?.last.smoothedMs ?? null);
    this.latencyProbeLastSharedEl.textContent = formatLatencyMetric(latencyProbe?.last.sharedMs ?? null);
    this.latencyProbeLastRenderEl.textContent = formatLatencyMetric(latencyProbe?.last.renderMs ?? null);

    const current = latencyProbe?.current;
    if (current && (
      current.rawMs !== null
      || current.smoothedMs !== null
      || current.sharedMs !== null
      || current.renderMs !== null
    )) {
      this.latencyProbeLastRawEl.textContent = formatLatencyMetric(current.rawMs);
      this.latencyProbeLastSmoothedEl.textContent = formatLatencyMetric(current.smoothedMs);
      this.latencyProbeLastSharedEl.textContent = formatLatencyMetric(current.sharedMs);
      this.latencyProbeLastRenderEl.textContent = formatLatencyMetric(current.renderMs);
    }

    this.latencyProbeAverageRawEl.textContent = formatLatencyMetric(latencyProbe?.average.rawMs ?? null);
    this.latencyProbeAverageSmoothedEl.textContent = formatLatencyMetric(latencyProbe?.average.smoothedMs ?? null);
    this.latencyProbeAverageSharedEl.textContent = formatLatencyMetric(latencyProbe?.average.sharedMs ?? null);
    this.latencyProbeAverageRenderEl.textContent = formatLatencyMetric(latencyProbe?.average.renderMs ?? null);

    setButtonEnabled(this.runLatencyProbeButton, analyzerIsLive);
    setButtonEnabled(
      this.resetLatencyProbeButton,
      Boolean(latencyProbe && (
        latencyProbe.sampleCount > 0
        || latencyProbe.status === 'armed'
        || latencyProbe.status === 'partial'
        || latencyProbe.status === 'unavailable'
      )),
    );
    setButtonActive(
      this.runLatencyProbeButton,
      latencyProbe?.status === 'armed' || latencyProbe?.status === 'partial',
      '#66d4ff',
    );
    setButtonActive(
      this.resetLatencyProbeButton,
      Boolean(latencyProbe && latencyProbe.sampleCount > 0),
      '#f2a756',
    );
  }

  private _updateControllers(
    controllerMap: Map<string, SignalController>,
    fields: UniformSchemaField[],
    values: UniformValueMap,
  ): void {
    fields.forEach((field) => {
      const controller = controllerMap.get(field.key);
      if (!controller) {
        return;
      }

      const numericValue = typeof values[field.key] === 'number'
        ? values[field.key] as number
        : Number(field.defaultValue);

      syncRangeValue(controller.input, numericValue);
      controller.valueLabel.textContent = numericValue.toFixed(2);
    });
  }

  private _syncFeelingControls(state: ShaderMasterSnapshot): void {
    const aiControlsFeeling = state.aiState.aiEnabled;

    this.feelingControllers.forEach((controller) => {
      controller.input.disabled = aiControlsFeeling;
      controller.input.style.opacity = aiControlsFeeling ? '0.6' : '1';
      controller.input.style.cursor = aiControlsFeeling ? 'not-allowed' : 'pointer';
    });

    this.feelingMetaEl.textContent = aiControlsFeeling
      ? 'AI is currently driving the effective feeling layer, so these sliders are read-only mirrors of the values reaching the shader.'
      : 'Manual feeling mode is active.';
  }

  private _updateAIState(state: ShaderMasterSnapshot): void {
    const aiState = state.aiState;
    const currentAIState = aiState.currentAIState;

    this.aiStatusEl.textContent = [
      aiState.aiEnabled ? 'AI Enabled' : 'AI Disabled',
      aiState.aiFallbackActive ? 'Fallback Active' : 'Live Response',
      aiState.aiStale ? 'Stale' : 'Fresh',
    ].join(' • ');
    this.aiMetaEl.textContent = `Last update: ${formatAIUpdateTimestamp(aiState.lastAIUpdateTime)}`;

    this.aiStateGridEl.replaceChildren();

    [
      ['Tension', currentAIState.tension],
      ['Glow', currentAIState.glow],
      ['Fragmentation', currentAIState.fragmentation],
      ['Stillness', currentAIState.stillness],
      ['Flow Bias', currentAIState.flowBias],
      ['Warmth', currentAIState.warmth],
    ].forEach(([label, value]) => {
      const chip = createElement('div', {
        display: 'grid',
        gap: '4px',
        padding: '9px 10px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      });
      chip.append(
        createElement('span', {
          fontSize: '11px',
          color: '#7f8a9a',
          lineHeight: '1.4',
        }, String(label)),
        createElement('span', {
          fontSize: '12px',
          color: '#edf1f7',
          fontWeight: '600',
          fontVariantNumeric: 'tabular-nums',
        }, Number(value).toFixed(2)),
      );
      this.aiStateGridEl.append(chip);
    });
  }

  private _updateSummary(state: ShaderMasterSnapshot): void {
    this.summaryGridEl.replaceChildren();

    [...AUDIO_UNIFORM_SCHEMA, ...FEELING_UNIFORM_SCHEMA].forEach((field) => {
      const sourceValues = field.source === 'audio'
        ? state.mappedAudioUniforms
        : state.effectiveFeelingUniforms;
      const numericValue = typeof sourceValues[field.key] === 'number'
        ? sourceValues[field.key] as number
        : Number(field.defaultValue);

      const chip = createElement('div', {
        display: 'grid',
        gap: '4px',
        padding: '9px 10px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      });
      chip.append(
        createElement('span', {
          fontSize: '11px',
          color: '#7f8a9a',
          lineHeight: '1.4',
        }, field.label),
        createElement('span', {
          fontSize: '12px',
          color: '#edf1f7',
          fontWeight: '600',
          fontVariantNumeric: 'tabular-nums',
        }, numericValue.toFixed(2)),
      );
      this.summaryGridEl.append(chip);
    });
  }

  private _renderSpectrogram(frames: number[][]): void {
    if (!this.spectrogramContext) {
      return;
    }

    const ctx = this.spectrogramContext;
    const width = this.spectrogramCanvas.width;
    const height = this.spectrogramCanvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.96)';
    ctx.fillRect(0, 0, width, height);

    if (frames.length === 0) {
      return;
    }

    const columnWidth = width / frames.length;
    const bandCount = frames[0]?.length || 0;
    if (bandCount === 0) {
      return;
    }
    const rowHeight = height / bandCount;

    frames.forEach((frame, frameIndex) => {
      frame.forEach((value, bandIndex) => {
        const amplitude = clamp01(value);
        const x = frameIndex * columnWidth;
        const y = height - ((bandIndex + 1) * rowHeight);
        const hue = 222 - (amplitude * 170);
        const saturation = 58 + (amplitude * 28);
        const lightness = 8 + (amplitude * 64);
        ctx.fillStyle = `hsl(${hue} ${saturation}% ${lightness}%)`;
        ctx.fillRect(x, y, Math.ceil(columnWidth), Math.ceil(rowHeight));
      });
    });
  }
}
