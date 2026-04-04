import type { ShaderMasterSnapshot } from '../contracts/types.ts';
import {
  FIELD_CLASS,
  createButton,
  createCardShell,
  createElement,
  setButtonEnabled,
} from './dom.ts';
import { PresetSelector } from './PresetSelector.ts';

export class OutputsPanel {
  readonly element: HTMLDivElement;

  private readonly listEl: HTMLDivElement;

  private readonly selectedOutputControlsEl: HTMLDivElement;

  private readonly createPresetSelector: PresetSelector;

  private readonly detailPresetSelector: PresetSelector;

  private readonly createButtonEl: HTMLButtonElement;

  private readonly duplicateButtonEl: HTMLButtonElement;

  private readonly deleteButtonEl: HTMLButtonElement;

  private readonly enabledToggleEl: HTMLInputElement;

  private readonly renameInputEl: HTMLInputElement;

  private readonly onSelectOutput: (outputId: string) => void;

  private selectedOutputId: string | null = null;

  private listSignature = '';

  private detailSignature = '';

  constructor({
    onCreateOutput,
    onSelectOutput,
    onDuplicateOutput,
    onDeleteOutput,
    onRenameOutput,
    onSetOutputEnabled,
    onChangeOutputPreset,
  }: {
    onCreateOutput: (presetId: string) => void;
    onSelectOutput: (outputId: string) => void;
    onDuplicateOutput: (outputId: string) => void;
    onDeleteOutput: (outputId: string) => void;
    onRenameOutput: (outputId: string, name: string) => void;
    onSetOutputEnabled: (outputId: string, enabled: boolean) => void;
    onChangeOutputPreset: (outputId: string, presetId: string) => void;
  }) {
    this.onSelectOutput = onSelectOutput;
    this.element = createCardShell('Outputs', undefined, {
      bracketHeader: true,
      extraClassName: 'es-shader-panel es-shader-panel--outputs',
    });
    this.element.classList.add('es-shader-panel');
    this.element.classList.add('es-shader-panel--outputs');

    const topControls = createElement('div', 'es-shader-panel__controls');
    this.createPresetSelector = new PresetSelector((presetId) => {
      this._selectedCreatePresetId = presetId;
    });
    this.createButtonEl = createButton('Add', () => {
      onCreateOutput(this._selectedCreatePresetId);
    });
    this.createButtonEl.classList.add('es-btn--minor', 'es-btn--tight');
    topControls.append(this.createPresetSelector.element, this.createButtonEl);

    this.listEl = createElement('div', 'es-shader-panel__list');

    this.selectedOutputControlsEl = createElement('div', 'es-shader-panel__detail');

    const renameGroup = createElement('div', 'es-shader-form-group');
    renameGroup.append(
      createElement('label', 'es-shader-form-group__label', 'Name'),
    );
    this.renameInputEl = createElement('input', FIELD_CLASS);
    this.renameInputEl.placeholder = 'Output';
    this.renameInputEl.addEventListener('change', () => {
      if (this.selectedOutputId) {
        onRenameOutput(this.selectedOutputId, this.renameInputEl.value);
      }
    });
    renameGroup.append(this.renameInputEl);

    const presetGroup = createElement('div', 'es-shader-form-group');
    this.detailPresetSelector = new PresetSelector((presetId) => {
      if (this.selectedOutputId) {
        onChangeOutputPreset(this.selectedOutputId, presetId);
      }
    });
    presetGroup.append(this.detailPresetSelector.element);

    const toggleGroup = createElement('label', 'es-shader-toggle');
    this.enabledToggleEl = createElement('input') as HTMLInputElement;
    this.enabledToggleEl.type = 'checkbox';
    this.enabledToggleEl.addEventListener('change', () => {
      if (this.selectedOutputId) {
        onSetOutputEnabled(this.selectedOutputId, this.enabledToggleEl.checked);
      }
    });
    toggleGroup.append(this.enabledToggleEl, createElement('span', {}, 'On'));

    const actionRow = createElement('div', 'es-shader-action-row');
    this.duplicateButtonEl = createButton('Copy', () => {
      if (this.selectedOutputId) {
        onDuplicateOutput(this.selectedOutputId);
      }
    });
    this.duplicateButtonEl.classList.add('es-btn--minor', 'es-btn--tight');
    this.deleteButtonEl = createButton('Drop', () => {
      if (this.selectedOutputId) {
        onDeleteOutput(this.selectedOutputId);
      }
    }, {
      borderColor: 'rgba(120, 170, 96, 0.28)',
      color: '#d5f7c4',
    });
    this.deleteButtonEl.classList.add('es-btn--minor', 'es-btn--tight');
    actionRow.append(this.duplicateButtonEl, this.deleteButtonEl);

    this.selectedOutputControlsEl.append(renameGroup, presetGroup, toggleGroup, actionRow);

    this.element.append(topControls, this.listEl, this.selectedOutputControlsEl);

    this._selectedCreatePresetId = '';
    setButtonEnabled(this.duplicateButtonEl, false);
    setButtonEnabled(this.deleteButtonEl, false);
  }

  private _selectedCreatePresetId: string;

  update(state: ShaderMasterSnapshot): void {
    this.selectedOutputId = state.selectedOutputId;
    this.createPresetSelector.update(state.presets, this._selectedCreatePresetId || state.presets[0]?.id || null);
    if (!this._selectedCreatePresetId && state.presets[0]) {
      this._selectedCreatePresetId = state.presets[0].id;
      this.createPresetSelector.update(state.presets, this._selectedCreatePresetId);
    }

    const nextListSignature = [
      state.selectedOutputId || '',
      ...state.outputs.map((output) => `${output.id}:${output.name}:${output.presetId}:${output.enabled}`),
    ].join('|');

    if (nextListSignature !== this.listSignature) {
      this.listSignature = nextListSignature;
      this.listEl.innerHTML = '';

      if (state.outputs.length === 0) {
        this.listEl.append(
          createElement('div', 'es-shader-empty', 'No outputs'),
        );
      }

      state.outputs.forEach((output) => {
        const isSelected = output.id === state.selectedOutputId;
        const row = createElement('button', 'es-shader-row');
        row.type = 'button';
        row.dataset.selected = isSelected ? 'true' : 'false';
        row.dataset.enabled = output.enabled ? 'true' : 'false';
        row.addEventListener('click', () => {
          this.onSelectOutput(output.id);
        });

        const copy = createElement('div', 'es-shader-row__copy');
        copy.append(
          createElement('span', 'es-shader-row__title', output.name),
          createElement('span', 'es-shader-row__meta', output.presetLabel),
        );

        const aside = createElement('div', 'es-shader-row__aside');
        const statusDot = createElement('span', 'es-shader-row__dot');
        statusDot.dataset.state = output.enabled ? 'live' : 'idle';
        aside.append(statusDot);

        row.append(copy, aside);
        this.listEl.append(row);
      });
    }

    this.updateSelectedOutputControls(state);
  }

  private updateSelectedOutputControls(state: ShaderMasterSnapshot): void {
    const selectedOutput = state.outputs.find((output) => output.id === state.selectedOutputId) || null;
    const selectedPreset = selectedOutput
      ? state.presets.find((preset) => preset.id === selectedOutput.presetId) || null
      : null;

    const nextDetailSignature = [
      selectedOutput?.id || '',
      selectedOutput?.name || '',
      selectedOutput?.presetId || '',
      selectedOutput?.enabled ? '1' : '0',
      ...(selectedPreset?.tags || []),
    ].join('|');

    const hasSelection = Boolean(selectedOutput);
    if (nextDetailSignature !== this.detailSignature) {
      this.detailSignature = nextDetailSignature;
      this.selectedOutputControlsEl.dataset.visible = hasSelection ? 'true' : 'false';
      this.renameInputEl.disabled = !hasSelection;
      this.renameInputEl.style.opacity = hasSelection ? '1' : '0.5';
      if (document.activeElement !== this.renameInputEl) {
        this.renameInputEl.value = selectedOutput?.name || '';
      }
      this.detailPresetSelector.update(state.presets, selectedOutput?.presetId || null);
      this.detailPresetSelector.setDisabled(!hasSelection);
      this.enabledToggleEl.checked = selectedOutput?.enabled ?? false;
      this.enabledToggleEl.disabled = !hasSelection;
      setButtonEnabled(this.duplicateButtonEl, hasSelection);
      setButtonEnabled(this.deleteButtonEl, hasSelection);

    }
  }
}
