import type {
  PresetCatalogEntry,
  ShaderOutputSnapshot,
  ShaderUniformValue,
  UniformSchemaField,
} from '../contracts/types.ts';
import {
  FIELD_CLASS,
  createCardShell,
  createElement,
  createTag,
  formatUniformValue,
  hexToVec3,
  vectorToHex,
} from './dom.ts';

interface FieldController {
  element: HTMLDivElement;
  update: (output: ShaderOutputSnapshot, preset: PresetCatalogEntry) => void;
}

function getFieldValue(
  field: UniformSchemaField,
  output: ShaderOutputSnapshot,
  preset: PresetCatalogEntry,
): ShaderUniformValue {
  if (field.source === 'manual') {
    return output.uniforms[field.key] ?? preset.defaultUniforms[field.key] ?? field.defaultValue;
  }

  return output.resolvedUniforms[field.key] ?? output.uniforms[field.key] ?? field.defaultValue;
}

function syncInputValue(input: HTMLInputElement, nextValue: string): void {
  if (document.activeElement === input) {
    return;
  }

  if (input.value !== nextValue) {
    input.value = nextValue;
  }
}

function syncCheckboxValue(input: HTMLInputElement, nextChecked: boolean): void {
  if (document.activeElement === input) {
    return;
  }

  if (input.checked !== nextChecked) {
    input.checked = nextChecked;
  }
}

function createPlaceholder(): HTMLDivElement {
  return createElement('div', {
    padding: '16px',
    borderRadius: '2px',
    border: '1px dashed rgba(120, 170, 96, 0.24)',
    background: 'rgba(8, 16, 8, 0.62)',
    color: '#86a675',
    fontSize: '13px',
    textAlign: 'center',
  }, 'Select an output');
}

export class UniformEditor {
  readonly element: HTMLDivElement;

  private readonly listEl: HTMLDivElement;

  private readonly onUpdateUniform: (outputId: string, key: string, value: unknown) => void;

  private readonly fieldControllers = new Map<string, FieldController>();

  private placeholderEl: HTMLDivElement | null = null;

  private currentOutputId: string | null = null;

  private currentPresetId: string | null = null;

  private currentFieldSignature = '';

  constructor({
    onUpdateUniform,
  }: {
    onUpdateUniform: (outputId: string, key: string, value: unknown) => void;
  }) {
    this.onUpdateUniform = onUpdateUniform;
    this.element = createCardShell('Params');
    this.listEl = createElement('div', {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxHeight: '720px',
      overflowY: 'auto',
      paddingRight: '4px',
    });
    this.element.append(this.listEl);
    this.showPlaceholder();
  }

  update({
    output,
    preset,
  }: {
    output: ShaderOutputSnapshot | null;
    preset: PresetCatalogEntry | null;
  }): void {
    if (!output || !preset) {
      this.currentOutputId = null;
      this.currentPresetId = null;
      this.currentFieldSignature = '';
      this.fieldControllers.clear();
      this.listEl.replaceChildren();
      this.showPlaceholder();
      return;
    }

    const visibleFields = preset.uniformSchema.filter((field) => !field.hidden);
    const nextFieldSignature = visibleFields.map((field) => field.key).join('|');
    const needsRebuild = (
      output.id !== this.currentOutputId
      || preset.id !== this.currentPresetId
      || nextFieldSignature !== this.currentFieldSignature
    );

    if (needsRebuild) {
      this.currentOutputId = output.id;
      this.currentPresetId = preset.id;
      this.currentFieldSignature = nextFieldSignature;
      this.placeholderEl = null;
      this.fieldControllers.clear();
      this.listEl.replaceChildren();

      visibleFields.forEach((field) => {
        const controller = this.createFieldController(output, preset, field);
        this.fieldControllers.set(field.key, controller);
        this.listEl.append(controller.element);
      });
      return;
    }

    visibleFields.forEach((field) => {
      this.fieldControllers.get(field.key)?.update(output, preset);
    });
  }

  private showPlaceholder(): void {
    if (this.placeholderEl) {
      return;
    }

    this.placeholderEl = createPlaceholder();
    this.listEl.append(this.placeholderEl);
  }

  private createFieldController(
    output: ShaderOutputSnapshot,
    preset: PresetCatalogEntry,
    field: UniformSchemaField,
  ): FieldController {
    const editable = field.source === 'manual';
    const card = createElement('div', {
      display: 'grid',
      gap: '10px',
      padding: '10px 12px',
      borderRadius: '3px',
      border: '1px solid rgba(120, 170, 96, 0.1)',
      background: editable ? 'rgba(8, 16, 8, 0.38)' : 'rgba(8, 16, 8, 0.26)',
      opacity: editable ? '1' : '0.78',
    });

    const header = createElement('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
    });
    const labelWrap = createElement('div', {
      display: 'grid',
      gap: '0',
    });
    labelWrap.append(
      createElement('span', {
        fontSize: '13px',
        fontWeight: '600',
        color: '#d5f7c4',
      }, field.label),
    );
    header.append(
      labelWrap,
      createTag(field.source, {
        textTransform: 'capitalize',
      }),
    );

    const content = createElement('div', {
      display: 'grid',
      gap: '8px',
    });

    let update = (_nextOutput: ShaderOutputSnapshot, _nextPreset: PresetCatalogEntry) => {};

    if (!editable) {
      const valueEl = createElement('div', {
        padding: '9px 10px',
        borderRadius: '2px',
        background: 'rgba(5, 12, 5, 0.5)',
        border: '1px solid rgba(120, 170, 96, 0.1)',
        color: '#b8de9d',
        fontSize: '13px',
      });
      content.append(valueEl);

      update = (nextOutput, nextPreset) => {
        valueEl.textContent = formatUniformValue(getFieldValue(field, nextOutput, nextPreset));
      };
    } else if (field.type === 'float' || field.type === 'int') {
      const rangeInput = createElement('input', {
        width: '100%',
        accentColor: '#9ddf74',
      }) as HTMLInputElement;
      rangeInput.type = 'range';
      rangeInput.min = String(field.min ?? 0);
      rangeInput.max = String(field.max ?? Math.max(Number(field.defaultValue), 1));
      rangeInput.step = String(field.step ?? (field.type === 'int' ? 1 : 0.01));

      const numberInput = createElement('input', FIELD_CLASS) as HTMLInputElement;
      numberInput.type = 'number';
      numberInput.min = field.min !== undefined ? String(field.min) : '';
      numberInput.max = field.max !== undefined ? String(field.max) : '';
      numberInput.step = String(field.step ?? (field.type === 'int' ? 1 : 0.01));

      const commitValue = (nextOutputId: string, nextValue: number) => {
        const normalizedValue = field.type === 'int' ? Math.round(nextValue) : nextValue;
        syncInputValue(rangeInput, String(normalizedValue));
        syncInputValue(numberInput, String(normalizedValue));
        this.onUpdateUniform(nextOutputId, field.key, normalizedValue);
      };

      rangeInput.addEventListener('input', () => {
        commitValue(output.id, Number.parseFloat(rangeInput.value));
      });
      numberInput.addEventListener('change', () => {
        commitValue(output.id, Number.parseFloat(numberInput.value));
      });

      content.append(rangeInput, numberInput);

      update = (nextOutput, nextPreset) => {
        const nextValue = getFieldValue(field, nextOutput, nextPreset);
        const numericValue = typeof nextValue === 'number' ? nextValue : Number(field.defaultValue);
        syncInputValue(rangeInput, String(numericValue));
        syncInputValue(numberInput, String(numericValue));
      };
    } else if (field.type === 'bool') {
      const checkboxLabel = createElement('label', {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: '#c9ecb7',
        fontSize: '13px',
        cursor: 'pointer',
      });
      const checkbox = createElement('input') as HTMLInputElement;
      checkbox.type = 'checkbox';
      const checkboxText = createElement('span');
      checkbox.addEventListener('change', () => {
        this.onUpdateUniform(output.id, field.key, checkbox.checked);
      });
      checkboxLabel.append(checkbox, checkboxText);
      content.append(checkboxLabel);

      update = (nextOutput, nextPreset) => {
        const checked = Boolean(getFieldValue(field, nextOutput, nextPreset));
        syncCheckboxValue(checkbox, checked);
        checkboxText.textContent = checked ? 'Enabled' : 'Disabled';
      };
    } else {
      const vectorGrid = createElement('div', {
        display: 'grid',
        gap: '8px',
      });

      const numericInputs: HTMLInputElement[] = [];

      const readVector = (): number[] => numericInputs.map((input, index) => {
        const parsedValue = Number.parseFloat(input.value);
        if (Number.isFinite(parsedValue)) {
          return parsedValue;
        }

        return Array.isArray(field.defaultValue) ? Number(field.defaultValue[index] ?? 0) : 0;
      });

      let colorInput: HTMLInputElement | null = null;
      if ((field.type === 'vec3' || field.type === 'vec4') && field.key.toLowerCase().includes('color')) {
        colorInput = createElement('input', {
          width: '100%',
          height: '40px',
          padding: '4px',
          background: 'rgba(6, 14, 8, 0.88)',
          border: '1px solid rgba(120, 170, 96, 0.28)',
          borderRadius: '2px',
        }) as HTMLInputElement;
        colorInput.type = 'color';
        colorInput.addEventListener('input', () => {
          const nextColor = hexToVec3(colorInput?.value || '#000000');
          const currentVector = readVector();
          const nextVector = field.type === 'vec4'
            ? [...nextColor, currentVector[3] ?? 1]
            : nextColor;
          this.onUpdateUniform(output.id, field.key, nextVector);
        });
        vectorGrid.append(colorInput);
      }

      const numericGrid = createElement('div', {
        display: 'grid',
        gridTemplateColumns: `repeat(${Array.isArray(field.defaultValue) ? field.defaultValue.length : 0}, minmax(0, 1fr))`,
        gap: '8px',
      });

      const initialValue = getFieldValue(field, output, preset);
      const initialVector = Array.isArray(initialValue)
        ? initialValue.map((component) => Number(component))
        : Array.isArray(field.defaultValue)
          ? [...field.defaultValue]
          : [];

      initialVector.forEach((component, index) => {
        const input = createElement('input', FIELD_CLASS) as HTMLInputElement;
        input.type = 'number';
        input.min = field.min !== undefined ? String(field.min) : '';
        input.max = field.max !== undefined ? String(field.max) : '';
        input.step = String(field.step ?? 0.01);
        input.value = String(component);
        input.addEventListener('change', () => {
          const nextVector = readVector();
          this.onUpdateUniform(output.id, field.key, nextVector);
        });
        numericInputs.push(input);
        numericGrid.append(input);
      });

      vectorGrid.append(numericGrid);
      content.append(vectorGrid);

      update = (nextOutput, nextPreset) => {
        const nextValue = getFieldValue(field, nextOutput, nextPreset);
        const nextVector = Array.isArray(nextValue)
          ? nextValue.map((component) => Number(component))
          : Array.isArray(field.defaultValue)
            ? [...field.defaultValue]
            : [];

        if (colorInput) {
          const nextColor = vectorToHex(nextVector);
          if (document.activeElement !== colorInput && colorInput.value !== nextColor) {
            colorInput.value = nextColor;
          }
        }

        numericInputs.forEach((input, index) => {
          syncInputValue(input, String(nextVector[index] ?? 0));
        });
      };
    }

    card.append(header, content);
    const controller = { element: card, update };
    controller.update(output, preset);
    return controller;
  }
}
