import type { ShaderMasterSnapshot } from '../contracts/types.ts';
import {
  FIELD_BASE_STYLES,
  createButton,
  createCardShell,
  createElement,
  createTag,
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
    this.element = createCardShell('Outputs', 'Outputs hold the preset and uniform state. Surfaces only point at output ids.');

    const topControls = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '10px',
      alignItems: 'center',
    });
    this.createPresetSelector = new PresetSelector((presetId) => {
      this._selectedCreatePresetId = presetId;
    });
    this.createButtonEl = createButton('Create Output', () => {
      onCreateOutput(this._selectedCreatePresetId);
    });
    topControls.append(this.createPresetSelector.element, this.createButtonEl);

    this.listEl = createElement('div', {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxHeight: '400px',
      overflowY: 'auto',
      paddingRight: '4px',
    });

    this.selectedOutputControlsEl = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '3px',
      border: '1px solid rgba(120, 170, 96, 0.18)',
      background: 'rgba(8, 16, 8, 0.72)',
    });

    const renameGroup = createElement('div', {
      display: 'grid',
      gap: '6px',
    });
    renameGroup.append(
      createElement('label', {
        fontSize: '11px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#7fa96f',
      }, 'Name'),
    );
    this.renameInputEl = createElement('input', {
      ...FIELD_BASE_STYLES,
    });
    this.renameInputEl.addEventListener('change', () => {
      if (this.selectedOutputId) {
        onRenameOutput(this.selectedOutputId, this.renameInputEl.value);
      }
    });
    renameGroup.append(this.renameInputEl);

    const presetGroup = createElement('div', {
      display: 'grid',
      gap: '6px',
    });
    presetGroup.append(
      createElement('label', {
        fontSize: '11px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#7fa96f',
      }, 'Preset'),
    );
    this.detailPresetSelector = new PresetSelector((presetId) => {
      if (this.selectedOutputId) {
        onChangeOutputPreset(this.selectedOutputId, presetId);
      }
    });
    presetGroup.append(this.detailPresetSelector.element);

    const toggleGroup = createElement('label', {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      color: '#c9ecb7',
      fontSize: '13px',
      cursor: 'pointer',
    });
    this.enabledToggleEl = createElement('input') as HTMLInputElement;
    this.enabledToggleEl.type = 'checkbox';
    this.enabledToggleEl.addEventListener('change', () => {
      if (this.selectedOutputId) {
        onSetOutputEnabled(this.selectedOutputId, this.enabledToggleEl.checked);
      }
    });
    toggleGroup.append(this.enabledToggleEl, createElement('span', {}, 'Enabled'));

    const actionRow = createElement('div', {
      display: 'flex',
      gap: '10px',
    });
    this.duplicateButtonEl = createButton('Duplicate', () => {
      if (this.selectedOutputId) {
        onDuplicateOutput(this.selectedOutputId);
      }
    });
    this.deleteButtonEl = createButton('Delete', () => {
      if (this.selectedOutputId) {
        onDeleteOutput(this.selectedOutputId);
      }
    }, {
      borderColor: 'rgba(120, 170, 96, 0.28)',
      color: '#d5f7c4',
    });
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
          createElement('div', {
          padding: '16px',
            borderRadius: '2px',
            border: '1px dashed rgba(120, 170, 96, 0.24)',
            color: '#86a675',
            fontSize: '13px',
            textAlign: 'center',
            background: 'rgba(8, 16, 8, 0.62)',
          }, 'No outputs yet. Create one from a preset.'),
        );
      }

      state.outputs.forEach((output) => {
        const isSelected = output.id === state.selectedOutputId;
        const row = createElement('button', {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '12px',
          alignItems: 'center',
          width: '100%',
          padding: '14px',
          borderRadius: '3px',
          border: isSelected ? '1px solid rgba(166, 223, 134, 0.42)' : '1px solid rgba(120, 170, 96, 0.18)',
          background: isSelected ? 'rgba(20, 38, 18, 0.82)' : 'rgba(8, 16, 8, 0.72)',
          color: '#d5f7c4',
          textAlign: 'left',
          cursor: 'pointer',
          boxShadow: isSelected ? '0 0 16px rgba(116, 255, 108, 0.1)' : 'none',
        });
        row.type = 'button';
        row.addEventListener('click', () => {
          this.onSelectOutput(output.id);
        });

        const copy = createElement('div', {
          display: 'grid',
          gap: '4px',
        });
        copy.append(
          createElement('span', {
            fontSize: '14px',
            fontWeight: '600',
          }, output.name),
          createElement('span', {
            fontSize: '12px',
            color: '#8fb181',
          }, output.presetLabel),
        );

        const tags = createElement('div', {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        });
        tags.append(
          createTag(output.enabled ? 'Enabled' : 'Disabled', output.enabled
            ? {
                background: 'rgba(20, 38, 18, 0.9)',
                borderColor: 'rgba(166, 223, 134, 0.26)',
                color: '#d5f7c4',
              }
            : {
                background: 'rgba(10, 17, 9, 0.9)',
                borderColor: 'rgba(120, 170, 96, 0.18)',
                color: '#88a675',
              }),
        );

        row.append(copy, tags);
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

      const tagsRow = createElement('div', {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
      });
      tagsRow.append(
        createTag(selectedOutput ? selectedOutput.id : 'No output selected'),
      );
      if (selectedPreset?.tags) {
        selectedPreset.tags.forEach((tag) => {
          tagsRow.append(createTag(tag));
        });
      }

      const previousTagsRow = this.selectedOutputControlsEl.querySelector('[data-role="output-tags"]');
      if (previousTagsRow) {
        previousTagsRow.remove();
      }
      tagsRow.dataset.role = 'output-tags';
      this.selectedOutputControlsEl.prepend(tagsRow);
    }
  }
}
