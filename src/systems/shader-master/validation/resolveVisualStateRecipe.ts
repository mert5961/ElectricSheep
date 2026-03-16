import {
  buildFeelingDefaults,
  CORE_UNIFORM_SCHEMA_MAP,
  schemaToMap,
} from '../contracts/uniforms.ts';
import type {
  ShaderOutput,
  ShaderPresetDefinition,
  UniformSchemaField,
  UniformValueMap,
} from '../contracts/types.ts';
import type {
  ResolvedVisualStateRecipe,
  VisualStateExpressiveValues,
  VisualStateRecipe,
  VisualStateRecipeResult,
  VisualStateTransitionEasing,
} from '../contracts/visualStateRecipe.ts';
import { validateUniformValue } from './validateUniformValue.ts';

const FEELING_KEY_MAP = {
  tension: 'u_feelTension',
  warmth: 'u_feelWarmth',
  fragmentation: 'u_feelFragmentation',
  glow: 'u_feelGlow',
  stillness: 'u_feelStillness',
  density: 'u_feelDensity',
} as const;

type AbstractExpressiveKey = 'patternDensity' | 'motionAmount' | 'scale';

interface ExpressiveFieldMapping {
  fieldKey: string;
  invert?: boolean;
}

const PRESET_EXPRESSIVE_MAPPINGS: Record<string, Partial<Record<AbstractExpressiveKey, ExpressiveFieldMapping[]>>> = {
  'cabinet-lines': {
    patternDensity: [{ fieldKey: 'u_lineDensity' }],
    motionAmount: [{ fieldKey: 'u_scanWarp' }],
  },
  'debug-grid': {
    patternDensity: [{ fieldKey: 'u_gridScale' }],
    scale: [{ fieldKey: 'u_lineThickness', invert: true }],
  },
  'dream-gradient': {
    motionAmount: [{ fieldKey: 'u_drift' }],
    scale: [{ fieldKey: 'u_swirl' }],
  },
  'organism-core': {
    patternDensity: [{ fieldKey: 'u_structureDensity' }],
    motionAmount: [{ fieldKey: 'u_motionTurbulence' }],
    scale: [{ fieldKey: 'u_bodyScale' }],
  },
  'fractured-bloom': {
    patternDensity: [{ fieldKey: 'u_shardScale' }],
    scale: [{ fieldKey: 'u_bloom' }],
  },
  pulse: {
    patternDensity: [{ fieldKey: 'u_ringCount' }],
    motionAmount: [{ fieldKey: 'u_softness', invert: true }],
  },
};

const ALLOWED_EASINGS = new Set<VisualStateTransitionEasing>(['linear', 'easeInOut', 'easeOut']);

function findTargetOutputId(
  recipe: VisualStateRecipe,
  outputs: Record<string, ShaderOutput>,
  outputOrder: string[],
  selectedOutputId: string | null,
): string | null {
  if (recipe.targetOutputId) {
    return outputs[recipe.targetOutputId] ? recipe.targetOutputId : null;
  }

  if (selectedOutputId && outputs[selectedOutputId]) {
    return selectedOutputId;
  }

  return outputOrder.find((outputId) => Boolean(outputs[outputId])) || null;
}

function normalizeTransition(recipe: VisualStateRecipe): ResolvedVisualStateRecipe['transition'] {
  const durationMs = Math.max(0, Math.round(recipe.transition.durationMs || 0));
  const easing = ALLOWED_EASINGS.has(recipe.transition.easing || 'easeInOut')
    ? (recipe.transition.easing || 'easeInOut')
    : 'easeInOut';

  if (recipe.transition.mode === 'immediate' || durationMs === 0) {
    return {
      mode: 'immediate',
      durationMs: 0,
      easing,
    };
  }

  return {
    mode: 'lerp',
    durationMs,
    easing,
  };
}

function resolveFeelingUniforms(recipe: VisualStateRecipe): {
  uniforms: UniformValueMap;
  errors: string[];
} {
  const nextFeelingUniforms = buildFeelingDefaults();
  const errors: string[] = [];

  Object.entries(FEELING_KEY_MAP).forEach(([recipeKey, uniformKey]) => {
    const value = recipe.feeling[recipeKey as keyof typeof FEELING_KEY_MAP];
    const field = CORE_UNIFORM_SCHEMA_MAP[uniformKey];
    const validationResult = field
      ? validateUniformValue(field, value)
      : { ok: false, error: `${uniformKey} is not available.` };
    if (!validationResult.ok || validationResult.value === undefined) {
      errors.push(validationResult.error || `Invalid feeling value for ${recipeKey}.`);
      return;
    }

    nextFeelingUniforms[uniformKey] = validationResult.value;
  });

  return {
    uniforms: nextFeelingUniforms,
    errors,
  };
}

function normalizeRecipeControlValue(value: number, invert = false): number {
  const nextValue = Math.max(0, Math.min(1, invert ? 1 - value : value));
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function mapNormalizedValueToField(
  field: UniformSchemaField,
  value: number,
  invert = false,
): number {
  const min = Number.isFinite(field.min) ? Number(field.min) : 0;
  const max = Number.isFinite(field.max) ? Number(field.max) : 1;
  const normalizedValue = normalizeRecipeControlValue(value, invert);
  return min + ((max - min) * normalizedValue);
}

function assignValidatedManualUniform(
  schemaMap: Record<string, UniformSchemaField>,
  expressiveUniforms: UniformValueMap,
  errors: string[],
  key: string,
  value: number,
): void {
  const field = schemaMap[key];
  if (!field) {
    errors.push(`Unknown manual uniform key for recipe target preset: ${key}.`);
    return;
  }

  if (field.source !== 'manual') {
    errors.push(`${key} is ${field.source}-driven and cannot be controlled by a visual state recipe.`);
    return;
  }

  const validationResult = validateUniformValue(field, value);
  if (!validationResult.ok || validationResult.value === undefined) {
    errors.push(validationResult.error || `Invalid recipe value for ${key}.`);
    return;
  }

  expressiveUniforms[key] = validationResult.value;
}

function resolveAbstractExpressiveUniforms(
  preset: ShaderPresetDefinition,
  expressive: VisualStateExpressiveValues,
  expressiveUniforms: UniformValueMap,
  errors: string[],
  warnings: string[],
): void {
  const schemaMap = schemaToMap(preset.uniformSchema);
  const presetMappings = PRESET_EXPRESSIVE_MAPPINGS[preset.id] || {};

  (['patternDensity', 'motionAmount', 'scale'] as AbstractExpressiveKey[]).forEach((key) => {
    const recipeValue = expressive[key];
    if (recipeValue === undefined) {
      return;
    }

    const mappings = presetMappings[key];
    if (!mappings || mappings.length === 0) {
      warnings.push(`${preset.label} does not expose a manual control for recipe expressive field "${key}".`);
      return;
    }

    mappings.forEach((mapping) => {
      const field = schemaMap[mapping.fieldKey];
      if (!field) {
        warnings.push(`Preset ${preset.label} is missing mapped uniform ${mapping.fieldKey} for expressive field "${key}".`);
        return;
      }

      assignValidatedManualUniform(
        schemaMap,
        expressiveUniforms,
        errors,
        mapping.fieldKey,
        mapNormalizedValueToField(field, recipeValue, mapping.invert),
      );
    });
  });
}

function resolveExpressiveUniforms(
  recipe: VisualStateRecipe,
  preset: ShaderPresetDefinition,
): {
  uniforms: UniformValueMap;
  errors: string[];
  warnings: string[];
} {
  const schemaMap = schemaToMap(preset.uniformSchema);
  const expressiveUniforms: UniformValueMap = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  assignValidatedManualUniform(schemaMap, expressiveUniforms, errors, 'u_speed', recipe.expressive.speed);
  assignValidatedManualUniform(schemaMap, expressiveUniforms, errors, 'u_intensity', recipe.expressive.intensity);
  resolveAbstractExpressiveUniforms(preset, recipe.expressive, expressiveUniforms, errors, warnings);

  return {
    uniforms: expressiveUniforms,
    errors,
    warnings,
  };
}

export function resolveVisualStateRecipe({
  recipe,
  outputs,
  outputOrder,
  selectedOutputId,
  presetRegistry,
}: {
  recipe: VisualStateRecipe;
  outputs: Record<string, ShaderOutput>;
  outputOrder: string[];
  selectedOutputId: string | null;
  presetRegistry: Record<string, ShaderPresetDefinition>;
}): VisualStateRecipeResult & { resolved?: ResolvedVisualStateRecipe } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const outputId = findTargetOutputId(recipe, outputs, outputOrder, selectedOutputId);

  if (!outputId) {
    return {
      ok: false,
      errors: [recipe.targetOutputId
        ? `Unknown target output: ${recipe.targetOutputId}.`
        : 'Visual state recipes require at least one available output.'],
      warnings: [],
    };
  }

  const targetOutput = outputs[outputId];
  const targetPresetId = recipe.preset || targetOutput.presetId;
  const preset = presetRegistry[targetPresetId];

  if (!preset) {
    return {
      ok: false,
      errors: [`Unknown preset: ${targetPresetId}.`],
      warnings: [],
    };
  }

  const feelingResolution = resolveFeelingUniforms(recipe);
  errors.push(...feelingResolution.errors);

  const expressiveResolution = resolveExpressiveUniforms(recipe, preset);
  errors.push(...expressiveResolution.errors);
  warnings.push(...expressiveResolution.warnings);

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings,
    };
  }

  return {
    ok: true,
    errors: [],
    warnings,
    resolved: {
      state: {
        recipeId: recipe.id,
        recipeLabel: recipe.label,
        outputId,
        presetId: preset.id,
        feelingUniforms: feelingResolution.uniforms,
        expressiveUniforms: expressiveResolution.uniforms,
      },
      transition: normalizeTransition(recipe),
      warnings,
    },
  };
}
