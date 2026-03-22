import type { ShaderMasterSnapshot, ShaderOutputSnapshot } from '../contracts/types.ts';
import { FIELD_BASE_STYLES, createCardShell, createElement, createTag } from './dom.ts';

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
    this.element = createCardShell('Routing', 'Route shared outputs into Geo Master surfaces without touching geometry.');
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
          borderRadius: '2px',
          border: '1px dashed rgba(120, 170, 96, 0.24)',
          color: '#86a675',
          fontSize: '13px',
          textAlign: 'center',
          background: 'rgba(8, 16, 8, 0.62)',
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
        borderRadius: '3px',
        border: isSelected ? '1px solid rgba(166, 223, 134, 0.42)' : '1px solid rgba(120, 170, 96, 0.18)',
        background: isSelected ? 'rgba(20, 38, 18, 0.82)' : 'rgba(8, 16, 8, 0.72)',
        boxShadow: isSelected ? '0 0 16px rgba(116, 255, 108, 0.1)' : 'none',
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
        color: '#d5f7c4',
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
          color: '#d5f7c4',
        }, surface.name),
        createElement('span', {
          fontSize: '12px',
          color: '#8fb181',
        }, `Layer ${surface.order + 1} • ${surface.visible ? 'Visible' : 'Hidden'}`),
      );

      const assignmentTag = createTag(
        surface.assignedOutputId && outputLookup[surface.assignedOutputId]
          ? outputLookup[surface.assignedOutputId].name
          : 'Unassigned',
        surface.assignedOutputId
          ? {
              background: 'rgba(20, 38, 18, 0.9)',
              borderColor: 'rgba(166, 223, 134, 0.26)',
              color: '#d5f7c4',
            }
          : undefined,
      );

      header.append(surfaceButton, assignmentTag);

      const select = createElement('select', {
        ...FIELD_BASE_STYLES,
        appearance: 'none',
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
