import type { ShaderMasterSnapshot } from '../contracts/types.ts';
import { createElement } from './dom.ts';
import { OutputsPanel } from './OutputsPanel.ts';
import { SurfacesPanel } from './SurfacesPanel.ts';
import { UniformEditor } from './UniformEditor.ts';

export class ShaderMasterPanel {
  readonly element: HTMLDivElement;

  private readonly surfacesPanel: SurfacesPanel;

  private readonly outputsPanel: OutputsPanel;

  private readonly uniformEditor: UniformEditor;

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
  }) {
    this.element = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.05fr) minmax(360px, 1.2fr)',
      gap: '18px',
      alignItems: 'stretch',
    });

    this.surfacesPanel = new SurfacesPanel({
      onSelectSurface,
      onAssignOutput,
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
    this.uniformEditor = new UniformEditor({
      onUpdateUniform: onUpdateOutputUniform,
    });

    this.element.append(
      this.surfacesPanel.element,
      this.outputsPanel.element,
      this.uniformEditor.element,
    );
  }

  update(state: ShaderMasterSnapshot | null): void {
    if (!state) {
      return;
    }

    this.surfacesPanel.update(state);
    this.outputsPanel.update(state);

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
