import type { ShaderMasterSnapshot } from '../contracts/types.ts';
import { FIELD_CLASS, createCardShell, createElement } from './dom.ts';

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
    this.element = createCardShell('Surfaces', undefined, {
      bracketHeader: true,
      extraClassName: 'es-shader-panel es-shader-panel--surfaces',
    });
    this.element.classList.add('es-shader-panel');
    this.element.classList.add('es-shader-panel--surfaces');
    this.listEl = createElement('div', 'es-shader-panel__list es-shader-panel__list--surfaces');
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
        createElement('div', 'es-shader-empty', 'No surfaces'),
      );
      return;
    }

    const displaySurfaces = [...state.surfaces].sort((left, right) => {
      if (left.order !== right.order) {
        return right.order - left.order;
      }

      return left.id.localeCompare(right.id);
    });

    displaySurfaces.forEach((surface) => {
      const isSelected = surface.id === state.selectedSurfaceId;
      const row = createElement('div', 'es-shader-row es-shader-row--surface');
      row.dataset.selected = isSelected ? 'true' : 'false';
      row.dataset.linked = surface.assignedOutputId ? 'true' : 'false';

      const header = createElement('div', 'es-shader-row__header');

      const surfaceButton = createElement('button', 'es-shader-row__button');
      surfaceButton.type = 'button';
      surfaceButton.addEventListener('click', () => {
        this.onSelectSurface(surface.id);
      });
      surfaceButton.append(createElement('span', 'es-shader-row__title', surface.name));

      const statusDot = createElement('span', 'es-shader-row__dot');
      statusDot.dataset.state = surface.assignedOutputId ? 'linked' : 'idle';
      header.append(surfaceButton, statusDot);

      row.append(header);

      if (isSelected) {
        const select = createElement('select', FIELD_CLASS);
        select.classList.add('es-shader-row__select');
        select.style.appearance = 'none';
        select.innerHTML = [
          '<option value="">Route</option>',
          ...state.outputs.map((output) => `<option value="${output.id}">${output.name}</option>`),
        ].join('');
        select.value = surface.assignedOutputId || '';
        select.addEventListener('change', () => {
          this.onAssignOutput(surface.id, select.value || null);
        });
        row.append(select);
      }

      this.listEl.append(row);
    });
  }
}
