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
import { createElement } from './dom.ts';
import { DebugSignalsPanel } from './DebugSignalsPanel.ts';
import { OutputsPanel } from './OutputsPanel.ts';
import { SurfacesPanel } from './SurfacesPanel.ts';
import { UniformEditor } from './UniformEditor.ts';

export class ShaderTab {
  readonly element: HTMLDivElement;

  private readonly outputsPanel: OutputsPanel;

  private readonly surfacesPanel: SurfacesPanel;

  private readonly uniformEditor: UniformEditor;

  private readonly debugSignalsPanel: DebugSignalsPanel;

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
    onStartAudioDebugTest,
    onStopAudioAnalyzer,
    onSetAudioAnalyzerDebugConfig,
    onResetAudioAnalyzerDebugConfig,
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
    onStartAudioDebugTest?: (mode: AudioAnalyzerTestMode) => void;
    onStopAudioAnalyzer?: () => void;
    onSetAudioAnalyzerDebugConfig?: (patch: Partial<AudioAnalyzerDebugConfig>) => void;
    onResetAudioAnalyzerDebugConfig?: () => void;
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
    this.element = createElement('div', {
      display: 'grid',
      gap: '18px',
      alignItems: 'stretch',
    });
    const workspaceGrid = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(320px, 0.95fr) minmax(300px, 0.9fr) minmax(360px, 1.15fr)',
      gap: '18px',
      alignItems: 'stretch',
    });

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
    this.debugSignalsPanel = new DebugSignalsPanel({
      onSetAudioUniforms,
      onSetFeelingUniforms,
      onResetAudioUniforms,
      onResetFeelingUniforms,
      onResetAllDebugSignals,
      onResetVisualStateRecipeState,
      onApplyVisualStateRecipe,
      onStartMicrophoneAudio,
      onStartAudioDebugTest,
      onStopAudioAnalyzer,
      onSetAudioAnalyzerDebugConfig,
      onResetAudioAnalyzerDebugConfig,
      onSetAudioVisualSignalTuning,
      onSetAudioVisualSoloKey,
      onResetAudioVisualMapping,
      onChangeOutputPreset,
    });

    workspaceGrid.append(
      this.outputsPanel.element,
      this.surfacesPanel.element,
      this.uniformEditor.element,
    );
    this.element.append(workspaceGrid, this.debugSignalsPanel.element);
  }

  update(state: ShaderMasterSnapshot | null, audioInputState: AudioAnalyzerState | null = null): void {
    if (!state) {
      return;
    }

    this.outputsPanel.update(state);
    this.surfacesPanel.update(state);
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
}
