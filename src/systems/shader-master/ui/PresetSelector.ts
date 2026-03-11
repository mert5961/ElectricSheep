import type { PresetCatalogEntry } from '../contracts/types.ts';
import { createElement } from './dom.ts';

export class PresetSelector {
  readonly element: HTMLSelectElement;

  private onChange: ((presetId: string) => void) | null;

  private optionsSignature = '';

  constructor(onChange: (presetId: string) => void) {
    this.onChange = onChange;
    this.element = createElement('select', {
      width: '100%',
      background: 'rgba(255,255,255,0.06)',
      color: '#edf1f7',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '10px 12px',
      fontSize: '13px',
      outline: 'none',
    });
    this.element.addEventListener('change', () => {
      if (this.onChange) {
        this.onChange(this.element.value);
      }
    });
  }

  update(presets: PresetCatalogEntry[], selectedPresetId: string | null): void {
    const nextOptionsSignature = presets
      .map((preset) => `${preset.id}:${preset.label}`)
      .join('|');

    if (nextOptionsSignature !== this.optionsSignature) {
      const fragment = document.createDocumentFragment();
      presets.forEach((preset) => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.label;
        fragment.append(option);
      });

      this.element.replaceChildren(fragment);
      this.optionsSignature = nextOptionsSignature;
    }

    const nextValue = selectedPresetId || '';
    if (this.element.value !== nextValue) {
      this.element.value = nextValue;
    }
  }

  setDisabled(disabled: boolean): void {
    this.element.disabled = disabled;
    this.element.style.opacity = disabled ? '0.5' : '1';
  }
}
