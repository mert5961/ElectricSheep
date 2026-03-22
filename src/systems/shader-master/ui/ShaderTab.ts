import type {
  ShaderMasterSnapshot,
  UniformValueMap,
} from '../contracts/types.ts';
import type { VisualStateRecipe } from '../contracts/visualStateRecipe.ts';
import type { AudioVisualSignalUniformKey } from '../contracts/audioVisualMapping.ts';
import type {
  AudioAnalyzerDebugConfig,
  AudioAnalyzerState,
  AudioAnalyzerTestMode,
} from '../../audio-analyzer/audioAnalyzerStore.ts';
import { createButton, createElement } from './dom.ts';
import { DebugSignalsPanel } from './DebugSignalsPanel.ts';
import { OperatorMonitorPanel } from './OperatorMonitorPanel.ts';
import { OutputsPanel } from './OutputsPanel.ts';
import { SurfacesPanel } from './SurfacesPanel.ts';
import { UniformEditor } from './UniformEditor.ts';
import { ensureOperatorWorkspaceStyles } from './operatorStyles.ts';

const SHADER_DEVELOPER_MODE_STORAGE_KEY = 'electric-sheep:shader-developer-mode';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === 'INPUT'
    || tagName === 'TEXTAREA'
    || tagName === 'SELECT'
    || Boolean(target.closest('[contenteditable="true"]'))
  );
}

function readInitialDeveloperMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (window.localStorage.getItem(SHADER_DEVELOPER_MODE_STORAGE_KEY) === '1') {
      return true;
    }
  } catch {}

  const params = new URLSearchParams(window.location.search);
  return params.get('shaderDebug') === '1';
}

function persistDeveloperMode(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SHADER_DEVELOPER_MODE_STORAGE_KEY, enabled ? '1' : '0');
  } catch {}
}

export class ShaderTab {
  readonly element: HTMLDivElement;

  private readonly operatorMonitor: OperatorMonitorPanel;

  private readonly outputsPanel: OutputsPanel;

  private readonly surfacesPanel: SurfacesPanel;

  private readonly uniformEditor: UniformEditor;

  private readonly debugSignalsPanel: DebugSignalsPanel;

  private readonly developerToggleButton: HTMLButtonElement;

  private readonly developerStatusEl: HTMLDivElement;

  private readonly debugPanelWrap: HTMLDivElement;

  private developerModeEnabled = false;

  constructor({
    onSelectSurface,
    onAssignOutput,
    onCreateOutput,
    onSelectOutput,
    onDuplicateOutput,
    onDeleteOutput,
    onRenameOutput,
    onSetOutputEnabled,
    onChangeOutputPreset,
    onUpdateOutputUniform,
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
  }: {
    onSelectSurface: (surfaceId: string) => void;
    onAssignOutput: (surfaceId: string, outputId: string | null) => void;
    onCreateOutput: (presetId: string) => void;
    onSelectOutput: (outputId: string) => void;
    onDuplicateOutput: (outputId: string) => void;
    onDeleteOutput: (outputId: string) => void;
    onRenameOutput: (outputId: string, name: string) => void;
    onSetOutputEnabled: (outputId: string, enabled: boolean) => void;
    onChangeOutputPreset: (outputId: string, presetId: string) => void;
    onUpdateOutputUniform: (outputId: string, key: string, value: unknown) => void;
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
  }) {
    ensureOperatorWorkspaceStyles();
    this.developerModeEnabled = readInitialDeveloperMode();

    this.element = createElement('div', {
      display: 'grid',
      gap: '16px',
      alignItems: 'stretch',
    });
    this.element.className = 'es-shader-tab';

    const modeBar = createElement('div');
    modeBar.className = 'es-machine-panel es-operator-modebar';
    const modeBarCopy = createElement('div', {
      display: 'grid',
      gap: '6px',
    });
    modeBarCopy.append(
      createElement('h3', {}, 'Operator Mode'),
      createElement('p', {}, 'The SHADER workspace now defaults to a compact live console. Developer-only diagnostics stay hidden until you explicitly unlock them.'),
    );
    const modeBarActions = createElement('div', {
      display: 'grid',
      gap: '8px',
      justifyItems: 'end',
    });
    this.developerToggleButton = createButton('Developer Mode Off', () => {
      this._setDeveloperMode(!this.developerModeEnabled);
    });
    this.developerStatusEl = createElement('div', {
      fontSize: '11px',
      color: 'var(--es-text-dim)',
    }, 'Toggle or press Ctrl/Cmd + Shift + D');
    modeBarActions.append(this.developerToggleButton, this.developerStatusEl);
    modeBar.append(modeBarCopy, modeBarActions);

    const operatorShell = createElement('div');
    operatorShell.className = 'es-operator-layout';

    const controlGrid = createElement('div');
    controlGrid.className = 'es-control-grid';

    this.outputsPanel = new OutputsPanel({
      onCreateOutput,
      onSelectOutput,
      onDuplicateOutput,
      onDeleteOutput,
      onRenameOutput,
      onSetOutputEnabled,
      onChangeOutputPreset,
    });
    this.surfacesPanel = new SurfacesPanel({
      onSelectSurface,
      onAssignOutput,
    });
    this.uniformEditor = new UniformEditor({
      onUpdateUniform: onUpdateOutputUniform,
    });
    this.operatorMonitor = new OperatorMonitorPanel({
      onStartMicrophoneAudio,
      onStartDisplayAudio,
      onStopAudioAnalyzer,
    });
    this.debugSignalsPanel = new DebugSignalsPanel({
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
    });

    controlGrid.append(
      this.outputsPanel.element,
      this.surfacesPanel.element,
      this.uniformEditor.element,
    );
    operatorShell.append(
      this.operatorMonitor.commandDeckElement,
      controlGrid,
      this.operatorMonitor.signalMonitorElement,
    );

    this.debugPanelWrap = createElement('div');
    this.debugPanelWrap.className = 'es-machine-panel es-dev-panel';
    const debugHead = createElement('div');
    debugHead.className = 'es-dev-panel-head';
    debugHead.append(
      createElement('h3', {}, 'Developer Debug Mode'),
      createElement('p', {}, 'All existing recipes, diagnostics, analyzer tests, smoothing controls, latency probes, and audio visual mapping tools remain here unchanged.'),
    );
    const debugBody = createElement('div');
    debugBody.className = 'es-dev-panel-body';
    debugBody.append(this.debugSignalsPanel.element);
    this.debugPanelWrap.append(debugHead, debugBody);

    this.element.append(modeBar, operatorShell, this.debugPanelWrap);

    this._installDeveloperShortcut();
    this._syncDeveloperMode();
  }

  update(state: ShaderMasterSnapshot | null, audioInputState: AudioAnalyzerState | null = null): void {
    if (!state) {
      return;
    }

    this.outputsPanel.update(state);
    this.surfacesPanel.update(state);
    this.operatorMonitor.update(state, audioInputState);
    this.debugSignalsPanel.update(state, audioInputState);

    const selectedOutput = state.outputs.find((output) => output.id === state.selectedOutputId) || null;
    const selectedPreset = selectedOutput
      ? state.presets.find((preset) => preset.id === selectedOutput.presetId) || null
      : null;

    this.uniformEditor.update({
      output: selectedOutput,
      preset: selectedPreset,
    });
  }

  private _installDeveloperShortcut(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('keydown', (event) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        this._setDeveloperMode(!this.developerModeEnabled);
      }
    });
  }

  private _setDeveloperMode(enabled: boolean): void {
    this.developerModeEnabled = enabled;
    persistDeveloperMode(enabled);
    this._syncDeveloperMode();
  }

  private _syncDeveloperMode(): void {
    this.debugPanelWrap.dataset.active = this.developerModeEnabled ? 'true' : 'false';
    this.developerToggleButton.textContent = this.developerModeEnabled ? 'Developer Mode On' : 'Developer Mode Off';
    this.developerToggleButton.dataset.active = this.developerModeEnabled ? 'true' : 'false';
    this.developerToggleButton.dataset.activeAccent = '#d7d38a';
    this.developerToggleButton.style.borderColor = this.developerModeEnabled ? 'rgba(215, 211, 138, 0.46)' : 'rgba(120, 170, 96, 0.28)';
    this.developerToggleButton.style.background = this.developerModeEnabled
      ? 'rgba(215, 211, 138, 0.14)'
      : 'linear-gradient(180deg, rgba(15, 30, 14, 0.96) 0%, rgba(7, 18, 7, 0.98) 100%)';
    this.developerToggleButton.style.color = this.developerModeEnabled ? '#f3efd0' : '#d5f7c4';
    this.developerToggleButton.style.boxShadow = this.developerModeEnabled
      ? '0 0 0 1px rgba(215, 211, 138, 0.18) inset, 0 0 18px rgba(215, 211, 138, 0.1)'
      : 'inset 0 0 0 1px rgba(189, 255, 172, 0.03), 0 0 12px rgba(116, 255, 108, 0.05)';
    this.developerStatusEl.textContent = this.developerModeEnabled
      ? 'Developer diagnostics unlocked'
      : 'Toggle or press Ctrl/Cmd + Shift + D';
  }
}
