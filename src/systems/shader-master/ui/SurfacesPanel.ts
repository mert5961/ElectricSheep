import type { ShaderMasterSnapshot, ShaderOutputSnapshot } from '../contracts/types.ts';
import { createCardShell, createElement, createTag } from './dom.ts';

export class SurfacesPanel {
  readonly element: HTMLDivElement;

  private readonly listEl: HTMLDivElement;

  private readonly onSelectSurface: (surfaceId: string) => void;

  private readonly onAssignOutput: (surfaceId: string, outputId: string | null) => void;

  private listSignature = '';

  constructor({
    onSelectSurface,
    onAssignOutput,
  }: {
    onSelectSurface: (surfaceId: string) => void;
    onAssignOutput: (surfaceId: string, outputId: string | null) => void;
  }) {
    this.onSelectSurface = onSelectSurface;
    this.onAssignOutput = onAssignOutput;
    this.element = createCardShell('Surfaces', 'Geo Master surfaces stay spatial; Shader Master only assigns output ids.');
    this.listEl = createElement('div', {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    });
    this.element.append(this.listEl);
  }

  update(state: ShaderMasterSnapshot): void {
    const nextListSignature = [
      state.selectedSurfaceId || '',
      ...state.outputs.map((output) => `${output.id}:${output.name}`),
      ...state.surfaces.map((surface) => `${surface.id}:${surface.name}:${surface.order}:${surface.assignedOutputId || ''}:${surface.visible}`),
    ].join('|');

    if (nextListSignature === this.listSignature) {
      return;
    }

    this.listSignature = nextListSignature;
    this.listEl.innerHTML = '';

    if (state.surfaces.length === 0) {
      this.listEl.append(
        createElement('div', {
          padding: '16px',
          borderRadius: '14px',
          border: '1px dashed rgba(255,255,255,0.12)',
          color: '#7f8a9a',
          fontSize: '13px',
          textAlign: 'center',
        }, 'No surfaces available. Add one from the output editor or control toolbar.'),
      );
      return;
    }

    const outputLookup = state.outputs.reduce<Record<string, ShaderOutputSnapshot>>((accumulator, output) => {
      accumulator[output.id] = output;
      return accumulator;
    }, {});

    state.surfaces.forEach((surface) => {
      const isSelected = surface.id === state.selectedSurfaceId;
      const row = createElement('div', {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '10px',
        padding: '14px',
        borderRadius: '14px',
        border: isSelected ? '1px solid rgba(95, 193, 255, 0.42)' : '1px solid rgba(255,255,255,0.08)',
        background: isSelected ? 'rgba(30, 82, 110, 0.22)' : 'rgba(255,255,255,0.03)',
      });

      const header = createElement('div', {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
      });

      const surfaceButton = createElement('button', {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4px',
        width: '100%',
        background: 'transparent',
        border: 'none',
        color: '#edf1f7',
        cursor: 'pointer',
        padding: '0',
        textAlign: 'left',
      });
      surfaceButton.type = 'button';
      surfaceButton.addEventListener('click', () => {
        this.onSelectSurface(surface.id);
      });
      surfaceButton.append(
        createElement('span', {
          fontSize: '14px',
          fontWeight: '600',
          color: '#edf1f7',
        }, surface.name),
        createElement('span', {
          fontSize: '12px',
          color: '#7f8a9a',
        }, `Layer ${surface.order + 1} • ${surface.visible ? 'Visible' : 'Hidden'}`),
      );

      const assignmentTag = createTag(
        surface.assignedOutputId && outputLookup[surface.assignedOutputId]
          ? outputLookup[surface.assignedOutputId].name
          : 'Unassigned',
        surface.assignedOutputId
          ? {
              background: 'rgba(62, 98, 152, 0.24)',
              borderColor: 'rgba(98, 146, 225, 0.24)',
              color: '#bdd3ff',
            }
          : undefined,
      );

      header.append(surfaceButton, assignmentTag);

      const select = createElement('select', {
        width: '100%',
        background: 'rgba(255,255,255,0.06)',
        color: '#edf1f7',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        padding: '9px 12px',
        fontSize: '13px',
        outline: 'none',
      });
      select.innerHTML = [
        '<option value="">Unassigned</option>',
        ...state.outputs.map((output) => `<option value="${output.id}">${output.name}</option>`),
      ].join('');
      select.value = surface.assignedOutputId || '';
      select.addEventListener('change', () => {
        this.onAssignOutput(surface.id, select.value || null);
      });

      row.append(header, select);
      this.listEl.append(row);
    });
  }
}
