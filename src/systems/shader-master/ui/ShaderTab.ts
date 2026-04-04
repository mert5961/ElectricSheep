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
import { DraggablePanelController } from '../../../ui/PanelDragger.ts';

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

  private readonly panelControllers: DraggablePanelController[] = [];

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
    const modeBarCopy = createElement('div', 'es-shader-modebar__copy');
    modeBarCopy.append(
      createElement('h3', 'es-shader-modebar__title', 'Shader'),
      createElement('p', 'es-shader-modebar__meta', 'Operator view'),
    );
    const modeBarActions = createElement('div', 'es-shader-modebar__actions');
    this.developerToggleButton = createButton('Debug Off', () => {
      this._setDeveloperMode(!this.developerModeEnabled);
    });
    this.developerStatusEl = createElement('div', 'es-shader-modebar__hint', 'Ctrl/Cmd + Shift + D');
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
      createElement('h3', {}, 'Debug'),
      createElement('p', {}, 'Analyzer / mapping'),
    );
    const debugBody = createElement('div');
    debugBody.className = 'es-dev-panel-body';
    debugBody.append(this.debugSignalsPanel.element);
    this.debugPanelWrap.append(debugHead, debugBody);

    this.element.append(modeBar, operatorShell, this.debugPanelWrap);
    this._setupDraggablePanels(operatorShell);

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

  private _setupDraggablePanels(boundsEl: HTMLDivElement): void {
    const draggablePanels = [
      ['shader-outputs-panel', this.outputsPanel.element],
      ['shader-surfaces-panel', this.surfacesPanel.element],
      ['shader-params-panel', this.uniformEditor.element],
    ] as const;

    draggablePanels.forEach(([id, element]) => {
      const handle = element.querySelector('[data-role="drag-handle"]') as HTMLElement | null;
      if (!handle) {
        return;
      }

      this.panelControllers.push(new DraggablePanelController({
        id,
        element,
        handle,
        boundsEl,
        mode: 'translate',
      }));
    });
  }

  private _syncDeveloperMode(): void {
    this.debugPanelWrap.dataset.active = this.developerModeEnabled ? 'true' : 'false';
    this.developerToggleButton.textContent = this.developerModeEnabled ? 'Debug On' : 'Debug Off';
    this.developerToggleButton.dataset.active = this.developerModeEnabled ? 'true' : 'false';
    this.developerToggleButton.dataset.activeAccent = 'rgba(51, 255, 51, 0.44)';
    this.developerToggleButton.style.borderColor = this.developerModeEnabled ? 'rgba(51, 255, 51, 0.38)' : 'rgba(51, 255, 51, 0.18)';
    this.developerToggleButton.style.background = this.developerModeEnabled
      ? 'rgba(51, 255, 51, 0.1)'
      : 'rgba(12, 24, 11, 0.42)';
    this.developerToggleButton.style.color = this.developerModeEnabled ? '#9bff8f' : '#75f76b';
    this.developerToggleButton.style.boxShadow = this.developerModeEnabled
      ? '0 0 0 1px rgba(51, 255, 51, 0.12) inset, 0 0 18px rgba(51, 255, 51, 0.08)'
      : '0 0 12px rgba(116, 255, 108, 0.05)';
    this.developerStatusEl.textContent = this.developerModeEnabled
      ? 'Ctrl/Cmd + Shift + D to hide'
      : 'Ctrl/Cmd + Shift + D';
  }
}
