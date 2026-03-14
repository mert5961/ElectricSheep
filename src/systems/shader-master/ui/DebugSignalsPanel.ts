import {
  AUDIO_UNIFORM_SCHEMA,
  FEELING_UNIFORM_SCHEMA,
} from '../contracts/uniforms.ts';
import type {
  ShaderMasterSnapshot,
  UniformSchemaField,
  UniformValueMap,
} from '../contracts/types.ts';
import type { VisualStateRecipe } from '../contracts/visualStateRecipe.ts';
import { listVisualStateRecipes } from '../registry/visualStateRecipes.ts';
import {
  createButton,
  createCardShell,
  createElement,
  createTag,
} from './dom.ts';

interface SignalController {
  input: HTMLInputElement;
  valueLabel: HTMLSpanElement;
}

const QUICK_RECIPES = listVisualStateRecipes();

function syncRangeValue(input: HTMLInputElement, nextValue: number): void {
  const serializedValue = nextValue.toFixed(2);
  if (document.activeElement !== input && input.value !== serializedValue) {
    input.value = serializedValue;
  }
}

export class DebugSignalsPanel {
  readonly element: HTMLDivElement;

  private readonly audioControllers = new Map<string, SignalController>();

  private readonly feelingControllers = new Map<string, SignalController>();

  private readonly recipeStatusEl: HTMLDivElement;

  private readonly recipeMetaEl: HTMLDivElement;

  private readonly summaryGridEl: HTMLDivElement;

  constructor({
    onSetAudioUniforms,
    onSetFeelingUniforms,
    onResetAudioUniforms,
    onResetFeelingUniforms,
    onResetAllDebugSignals,
    onResetVisualStateRecipeState,
    onApplyVisualStateRecipe,
  }: {
    onSetAudioUniforms: (uniforms: Partial<UniformValueMap>) => void;
    onSetFeelingUniforms: (uniforms: Partial<UniformValueMap>) => void;
    onResetAudioUniforms: () => void;
    onResetFeelingUniforms: () => void;
    onResetAllDebugSignals: () => void;
    onResetVisualStateRecipeState: () => void;
    onApplyVisualStateRecipe: (recipe: VisualStateRecipe) => void;
  }) {
    this.element = createCardShell(
      'Visual State Recipes',
      'Recipes choreograph preset choice, shared feeling buckets, safe output controls, and transition timing. Audio sliders stay separate for lower-level debugging.',
    );
    Object.assign(this.element.style, {
      minHeight: 'unset',
      gap: '18px',
    });

    const actionRow = createElement('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
    });
    actionRow.append(
      createButton('Reset Audio', onResetAudioUniforms),
      createButton('Reset Feelings', onResetFeelingUniforms),
      createButton('Clear Recipe', onResetVisualStateRecipeState),
      createButton('Reset All', onResetAllDebugSignals, {
        borderColor: 'rgba(231, 176, 83, 0.28)',
        color: '#ffe0ad',
      }),
    );

    const quickRow = createElement('div', {
      display: 'grid',
      gap: '10px',
      padding: '14px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
    });
    const quickHeader = createElement('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      flexWrap: 'wrap',
    });
    const quickHeaderCopy = createElement('div', {
      display: 'grid',
      gap: '6px',
      maxWidth: '540px',
    });
    quickHeaderCopy.append(
      createTag('Primary Test States', {
        background: 'rgba(255,255,255,0.08)',
        color: '#d7deea',
      }),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.6',
      }, 'These recipe buttons are now the fastest way to test meaningful visual intent changes in SHADER.'),
    );
    const quickHeaderStatus = createElement('div', {
      display: 'grid',
      gap: '4px',
      minWidth: '220px',
    });
    this.recipeStatusEl = createElement('div', {
      fontSize: '12px',
      fontWeight: '600',
      color: '#edf1f7',
    }, 'Manual / Custom');
    this.recipeMetaEl = createElement('div', {
      fontSize: '12px',
      color: '#7f8a9a',
      lineHeight: '1.5',
    }, 'Apply a recipe to drive preset, feeling, expressive controls, and transition timing together.');
    quickHeaderStatus.append(this.recipeStatusEl, this.recipeMetaEl);
    quickHeader.append(quickHeaderCopy, quickHeaderStatus);

    const quickButtons = createElement('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
    });
    QUICK_RECIPES.forEach((recipe) => {
      quickButtons.append(
        createButton(recipe.label, () => {
          onApplyVisualStateRecipe(recipe);
        }, {
          background: 'rgba(255,255,255,0.05)',
        }),
      );
    });
    quickRow.append(quickHeader, quickButtons);

    const sections = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(280px, 0.9fr)',
      gap: '16px',
      alignItems: 'start',
    });
    sections.append(
      this._createSignalSection(
        'Audio',
        'Global debug audio values feeding audio-sourced uniforms.',
        AUDIO_UNIFORM_SCHEMA,
        this.audioControllers,
        onSetAudioUniforms,
      ),
      this._createSignalSection(
        'Feeling',
        'Global debug feeling values feeding feeling-sourced uniforms. Manual edits here intentionally break out of the active recipe state.',
        FEELING_UNIFORM_SCHEMA,
        this.feelingControllers,
        onSetFeelingUniforms,
      ),
    );

    const summaryCard = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
      minHeight: '100%',
    });
    summaryCard.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, 'Active Shared Signals'),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.6',
      }, 'Recipes write into the shared feeling bucket and safe output-level controls. Audio remains a separate shared input layer.'),
    );
    this.summaryGridEl = createElement('div', {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '8px',
    });
    summaryCard.append(this.summaryGridEl);
    sections.append(summaryCard);

    this.element.append(actionRow, quickRow, sections);
  }

  update(state: ShaderMasterSnapshot): void {
    this._updateRecipeStatus(state);
    this._updateControllers(this.audioControllers, AUDIO_UNIFORM_SCHEMA, state.audioUniforms);
    this._updateControllers(this.feelingControllers, FEELING_UNIFORM_SCHEMA, state.feelingUniforms);
    this._updateSummary(state);
  }

  private _createSignalSection(
    title: string,
    description: string,
    fields: UniformSchemaField[],
    controllerMap: Map<string, SignalController>,
    onChange: (uniforms: Partial<UniformValueMap>) => void,
  ): HTMLDivElement {
    const section = createElement('div', {
      display: 'grid',
      gap: '12px',
      padding: '14px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.03)',
    });
    section.append(
      createElement('div', {
        display: 'grid',
        gap: '4px',
      }),
    );

    const header = section.firstElementChild as HTMLDivElement;
    header.append(
      createElement('div', {
        fontSize: '12px',
        fontWeight: '600',
        color: '#d7deea',
      }, title),
      createElement('div', {
        fontSize: '12px',
        color: '#7f8a9a',
        lineHeight: '1.55',
      }, description),
    );

    fields.forEach((field) => {
      const row = createElement('div', {
        display: 'grid',
        gap: '8px',
      });
      const rowHeader = createElement('div', {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
      });
      const valueLabel = createElement('span', {
        fontSize: '12px',
        fontVariantNumeric: 'tabular-nums',
        color: '#d7deea',
      }, '0.00');

      rowHeader.append(
        createElement('span', {
          fontSize: '13px',
          color: '#edf1f7',
          fontWeight: '600',
        }, field.label),
        valueLabel,
      );

      const input = createElement('input', {
        width: '100%',
        accentColor: field.source === 'audio' ? '#66d4ff' : '#ffb454',
      }) as HTMLInputElement;
      input.type = 'range';
      input.min = String(field.min ?? 0);
      input.max = String(field.max ?? 1);
      input.step = String(field.step ?? 0.01);
      input.value = Number(field.defaultValue).toFixed(2);
      input.addEventListener('input', () => {
        const nextValue = Number.parseFloat(input.value);
        valueLabel.textContent = nextValue.toFixed(2);
        onChange({
          [field.key]: nextValue,
        });
      });

      row.append(rowHeader, input);
      section.append(row);
      controllerMap.set(field.key, {
        input,
        valueLabel,
      });
    });

    return section;
  }

  private _updateRecipeStatus(state: ShaderMasterSnapshot): void {
    const activeTransition = state.visualState.transition;
    const activeState = activeTransition ? state.visualState.target : state.visualState.current;

    if (!activeState) {
      this.recipeStatusEl.textContent = 'Manual / Custom';
      this.recipeMetaEl.textContent = 'Apply a recipe to drive preset, feeling, expressive controls, and transition timing together.';
      return;
    }

    const output = state.outputs.find((entry) => entry.id === activeState.outputId) || null;
    const preset = state.presets.find((entry) => entry.id === activeState.presetId) || null;

    if (activeTransition) {
      const progress = activeTransition.durationMs > 0
        ? Math.min(1, activeTransition.elapsedMs / activeTransition.durationMs)
        : 1;
      this.recipeStatusEl.textContent = `Transitioning to ${activeState.recipeLabel}`;
      this.recipeMetaEl.textContent = [
        `${Math.round(progress * 100)}%`,
        `${activeTransition.durationMs} ms`,
        output?.name || activeState.outputId,
        preset?.label || activeState.presetId,
      ].join(' • ');
      return;
    }

    this.recipeStatusEl.textContent = `Active Recipe: ${activeState.recipeLabel}`;
    this.recipeMetaEl.textContent = [
      output?.name || activeState.outputId,
      preset?.label || activeState.presetId,
      'settled',
    ].join(' • ');
  }

  private _updateControllers(
    controllerMap: Map<string, SignalController>,
    fields: UniformSchemaField[],
    values: UniformValueMap,
  ): void {
    fields.forEach((field) => {
      const controller = controllerMap.get(field.key);
      if (!controller) {
        return;
      }

      const numericValue = typeof values[field.key] === 'number'
        ? values[field.key] as number
        : Number(field.defaultValue);

      syncRangeValue(controller.input, numericValue);
      controller.valueLabel.textContent = numericValue.toFixed(2);
    });
  }

  private _updateSummary(state: ShaderMasterSnapshot): void {
    this.summaryGridEl.replaceChildren();

    [...AUDIO_UNIFORM_SCHEMA, ...FEELING_UNIFORM_SCHEMA].forEach((field) => {
      const sourceValues = field.source === 'audio' ? state.audioUniforms : state.feelingUniforms;
      const numericValue = typeof sourceValues[field.key] === 'number'
        ? sourceValues[field.key] as number
        : Number(field.defaultValue);

      const chip = createElement('div', {
        display: 'grid',
        gap: '4px',
        padding: '9px 10px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      });
      chip.append(
        createElement('span', {
          fontSize: '11px',
          color: '#7f8a9a',
          lineHeight: '1.4',
        }, field.label),
        createElement('span', {
          fontSize: '12px',
          color: '#edf1f7',
          fontWeight: '600',
          fontVariantNumeric: 'tabular-nums',
        }, numericValue.toFixed(2)),
      );
      this.summaryGridEl.append(chip);
    });
  }
}
