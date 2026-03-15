import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  buildAudioDefaults,
  buildFeelingDefaults,
  buildRuntimeDefaults,
  cloneUniformMap,
  cloneUniformValue,
  CORE_UNIFORM_SCHEMA_MAP,
  createDefaultUniforms,
  schemaToMap,
} from '../contracts/uniforms.ts';
import {
  cloneAudioVisualMappingState,
  createDefaultAudioVisualMappingState,
  sanitizeAudioVisualSignalTuning,
  type AudioVisualMappingState,
  type AudioVisualSignalUniformKey,
} from '../contracts/audioVisualMapping.ts';
import type {
  ShaderMasterSnapshot,
  ShaderOutput,
  ShaderOutputSnapshot,
  ShaderPresetDefinition,
  SurfaceReference,
  UniformSchemaField,
  UniformValueMap,
} from '../contracts/types.ts';
import type { VisualIntent, VisualIntentResult } from '../contracts/visualIntent.ts';
import type {
  ResolvedVisualState,
  VisualStateRecipe,
  VisualStateRecipeResult,
  VisualStateRuntimeSnapshot,
  VisualStateTransitionEasing,
  VisualStateTransitionState,
} from '../contracts/visualStateRecipe.ts';
import {
  cloneResolvedVisualState,
  cloneVisualStateRuntimeSnapshot,
} from '../contracts/visualStateRecipe.ts';
import { listPresetCatalog, presetRegistry } from '../registry/presetRegistry.ts';
import { resolveMappedAudioUniforms } from '../runtime/resolveMappedAudioUniforms.ts';
import { resolveFinalUniforms } from '../runtime/resolveFinalUniforms.ts';
import { resolveVisualStateRecipe } from '../validation/resolveVisualStateRecipe.ts';
import { validateUniformValue } from '../validation/validateUniformValue.ts';

interface InternalShaderMasterState {
  outputOrder: string[];
  surfaces: SurfaceReference[];
  uiRevision: number;
  outputCounter: number;
}

export interface ShaderMasterStoreState extends InternalShaderMasterState {
  presetRegistry: Record<string, ShaderPresetDefinition>;
  outputs: Record<string, ShaderOutput>;
  surfaceAssignments: Record<string, string | null>;
  selectedOutputId: string | null;
  selectedSurfaceId: string | null;
  runtimeUniforms: UniformValueMap;
  audioUniforms: UniformValueMap;
  audioVisualMapping: AudioVisualMappingState;
  feelingUniforms: UniformValueMap;
  currentVisualState: ResolvedVisualState | null;
  targetVisualState: ResolvedVisualState | null;
  activeVisualStateTransition: VisualStateTransitionState | null;
  createOutput: (presetId?: string, name?: string) => ShaderOutput | null;
  duplicateOutput: (outputId: string) => ShaderOutput | null;
  deleteOutput: (outputId: string) => boolean;
  renameOutput: (outputId: string, name: string) => boolean;
  setOutputEnabled: (outputId: string, enabled: boolean) => boolean;
  changeOutputPreset: (outputId: string, presetId: string) => boolean;
  updateOutputUniform: (outputId: string, key: string, value: unknown) => VisualIntentResult;
  assignOutputToSurface: (surfaceId: string, outputId: string | null) => boolean;
  syncSurfaces: (surfaces: SurfaceReference[]) => void;
  setSelectedOutput: (outputId: string | null) => void;
  setSelectedSurface: (surfaceId: string | null) => void;
  setRuntimeUniforms: (uniforms: Partial<UniformValueMap>) => void;
  setAudioUniforms: (
    uniforms: Partial<UniformValueMap>,
    options?: {
      updateUiRevision?: boolean;
    },
  ) => void;
  setAudioVisualSignalTuning: (
    key: AudioVisualSignalUniformKey,
    patch: Partial<AudioVisualMappingState['signals'][AudioVisualSignalUniformKey]>,
  ) => void;
  setAudioVisualSoloKey: (key: AudioVisualSignalUniformKey | null) => void;
  resetAudioVisualMapping: () => void;
  setFeelingUniforms: (uniforms: Partial<UniformValueMap>) => void;
  resetAudioUniforms: () => void;
  resetFeelingUniforms: () => void;
  resetAllDebugSignals: () => void;
  applyVisualStateRecipe: (recipe: VisualStateRecipe) => VisualStateRecipeResult;
  setTargetVisualState: (
    targetState: ResolvedVisualState,
    transition: {
      mode: 'immediate' | 'lerp';
      durationMs: number;
      easing: VisualStateTransitionEasing;
    },
  ) => VisualStateRecipeResult;
  advanceVisualStateTransition: (deltaTimeMs: number) => void;
  resetVisualStateRecipeState: () => void;
  hydrateSnapshot: (snapshot: ShaderMasterSnapshot) => void;
  applyVisualIntent: (intent: VisualIntent) => VisualIntentResult;
}

export type ShaderMasterStore = StoreApi<ShaderMasterStoreState>;

const DEFAULT_OUTPUT_ID = 'output-main';
const DEFAULT_OUTPUT_NAME = 'Main Output';
const VISUAL_INTENT_KEYS = new Set(['targetOutputId', 'preset', 'uniforms']);

function normalizeName(name: string | undefined, fallback: string): string {
  const trimmedName = name?.trim();
  return trimmedName && trimmedName.length > 0 ? trimmedName : fallback;
}

function incrementUiRevision(state: ShaderMasterStoreState): number {
  return state.uiRevision + 1;
}

function getPresetOrFallback(
  registry: Record<string, ShaderPresetDefinition>,
  presetId?: string,
): ShaderPresetDefinition {
  if (presetId && registry[presetId]) {
    return registry[presetId];
  }

  if (registry['debug-grid']) {
    return registry['debug-grid'];
  }

  return Object.values(registry)[0];
}

function createOutputRecord(
  id: string,
  name: string,
  preset: ShaderPresetDefinition,
): ShaderOutput {
  return {
    id,
    name,
    presetId: preset.id,
    uniforms: cloneUniformMap(preset.defaultUniforms),
    enabled: true,
  };
}

function buildInitialOutputs(registry: Record<string, ShaderPresetDefinition>): Record<string, ShaderOutput> {
  return {
    [DEFAULT_OUTPUT_ID]: createOutputRecord(
      DEFAULT_OUTPUT_ID,
      DEFAULT_OUTPUT_NAME,
      getPresetOrFallback(registry, 'debug-grid'),
    ),
  };
}

function getUniqueOutputName(outputs: Record<string, ShaderOutput>, baseName: string): string {
  const existingNames = new Set(Object.values(outputs).map((output) => output.name));
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (existingNames.has(`${baseName} ${suffix}`)) {
    suffix += 1;
  }

  return `${baseName} ${suffix}`;
}

function getNextOutputId(state: ShaderMasterStoreState): string {
  let nextCounter = state.outputCounter + 1;
  let candidateId = `output-${nextCounter}`;

  while (state.outputs[candidateId]) {
    nextCounter += 1;
    candidateId = `output-${nextCounter}`;
  }

  return candidateId;
}

function coerceAndValidateUniform(
  field: UniformSchemaField,
  value: unknown,
): VisualIntentResult & { normalizedValue?: UniformValueMap[string] } {
  const validationResult = validateUniformValue(field, value);
  if (!validationResult.ok || validationResult.value === undefined) {
    return {
      ok: false,
      errors: [validationResult.error || `Invalid value for ${field.key}.`],
    };
  }

  return {
    ok: true,
    errors: [],
    normalizedValue: validationResult.value,
  };
}

function remapUniformsForPreset(
  preset: ShaderPresetDefinition,
  previousUniforms: UniformValueMap,
): UniformValueMap {
  const nextUniforms = createDefaultUniforms(preset.uniformSchema, preset.defaultUniforms);

  preset.uniformSchema.forEach((field) => {
    const previousValue = previousUniforms[field.key];
    if (previousValue === undefined) {
      return;
    }

    const validationResult = validateUniformValue(field, previousValue);
    if (validationResult.ok && validationResult.value !== undefined) {
      nextUniforms[field.key] = validationResult.value;
    }
  });

  return nextUniforms;
}

function mergeUniformBucket(
  currentBucket: UniformValueMap,
  patch: Partial<UniformValueMap>,
  source: UniformSchemaField['source'],
): UniformValueMap {
  const nextBucket = cloneUniformMap(currentBucket);

  Object.entries(patch).forEach(([key, value]) => {
    const field = CORE_UNIFORM_SCHEMA_MAP[key];
    if (!field || field.source !== source || value === undefined) {
      return;
    }

    const validationResult = validateUniformValue(field, value);
    if (validationResult.ok && validationResult.value !== undefined) {
      nextBucket[key] = validationResult.value;
    }
  });

  return nextBucket;
}

function buildOrderedOutputs(state: ShaderMasterStoreState): ShaderOutput[] {
  return state.outputOrder
    .map((outputId) => state.outputs[outputId])
    .filter((output): output is ShaderOutput => Boolean(output));
}

function buildMappedAudioUniforms(state: ShaderMasterStoreState): UniformValueMap {
  return resolveMappedAudioUniforms(state.audioUniforms, state.audioVisualMapping);
}

function buildOutputSnapshot(
  state: ShaderMasterStoreState,
  output: ShaderOutput,
): ShaderOutputSnapshot {
  const preset = state.presetRegistry[output.presetId];
  const mappedAudioUniforms = buildMappedAudioUniforms(state);
  return {
    ...output,
    uniforms: cloneUniformMap(output.uniforms),
    presetLabel: preset?.label || output.presetId,
    resolvedUniforms: preset
      ? resolveFinalUniforms({
          preset,
          output,
          runtimeUniforms: state.runtimeUniforms,
          audioUniforms: mappedAudioUniforms,
          feelingUniforms: state.feelingUniforms,
        })
      : cloneUniformMap(output.uniforms),
  };
}

function areUniformValuesEqual(
  left: UniformValueMap[string] | undefined,
  right: UniformValueMap[string] | undefined,
): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  return left === right;
}

function clearVisualStateStoreFields(): Pick<
  ShaderMasterStoreState,
  'currentVisualState' | 'targetVisualState' | 'activeVisualStateTransition'
> {
  return {
    currentVisualState: null,
    targetVisualState: null,
    activeVisualStateTransition: null,
  };
}

function buildVisualStateSnapshot(
  state: ShaderMasterStoreState,
): VisualStateRuntimeSnapshot {
  return cloneVisualStateRuntimeSnapshot({
    current: state.currentVisualState,
    target: state.targetVisualState,
    transition: state.activeVisualStateTransition,
  });
}

function isVisualStateTargetingOutput(
  state: ShaderMasterStoreState,
  outputId: string,
): boolean {
  return state.currentVisualState?.outputId === outputId
    || state.targetVisualState?.outputId === outputId
    || state.activeVisualStateTransition?.outputId === outputId;
}

function isVisualStateManagedUniformKey(
  state: ShaderMasterStoreState,
  outputId: string,
  key: string,
): boolean {
  if (!isVisualStateTargetingOutput(state, outputId)) {
    return false;
  }

  return state.currentVisualState?.expressiveUniforms[key] !== undefined
    || state.targetVisualState?.expressiveUniforms[key] !== undefined
    || state.activeVisualStateTransition?.fromState.expressiveUniforms[key] !== undefined;
}

function applyResolvedVisualStateMutation(
  state: ShaderMasterStoreState,
  visualState: ResolvedVisualState,
): {
  nextOutputs: Record<string, ShaderOutput>;
  nextFeelingUniforms: UniformValueMap;
  changed: boolean;
} {
  const targetOutput = state.outputs[visualState.outputId];
  const preset = state.presetRegistry[visualState.presetId];
  if (!targetOutput || !preset) {
    return {
      nextOutputs: state.outputs,
      nextFeelingUniforms: state.feelingUniforms,
      changed: false,
    };
  }

  let nextOutput = targetOutput;
  let nextUniforms = cloneUniformMap(targetOutput.uniforms);
  let outputChanged = false;

  if (targetOutput.presetId !== preset.id) {
    nextUniforms = remapUniformsForPreset(preset, targetOutput.uniforms);
    nextOutput = {
      ...targetOutput,
      presetId: preset.id,
      uniforms: nextUniforms,
    };
    outputChanged = true;
  }

  Object.entries(visualState.expressiveUniforms).forEach(([key, value]) => {
    if (value === undefined || areUniformValuesEqual(nextUniforms[key], value)) {
      return;
    }

    nextUniforms[key] = cloneUniformValue(value);
    outputChanged = true;
  });

  if (outputChanged) {
    nextOutput = {
      ...nextOutput,
      uniforms: nextUniforms,
    };
  }

  const nextFeelingUniforms = cloneUniformMap(state.feelingUniforms);
  let feelingChanged = false;

  Object.entries(visualState.feelingUniforms).forEach(([key, value]) => {
    if (value === undefined || areUniformValuesEqual(nextFeelingUniforms[key], value)) {
      return;
    }

    nextFeelingUniforms[key] = cloneUniformValue(value);
    feelingChanged = true;
  });

  return {
    nextOutputs: outputChanged
      ? {
          ...state.outputs,
          [visualState.outputId]: nextOutput,
        }
      : state.outputs,
    nextFeelingUniforms: feelingChanged ? nextFeelingUniforms : state.feelingUniforms,
    changed: outputChanged || feelingChanged,
  };
}

function captureCurrentVisualState(
  state: ShaderMasterStoreState,
  targetState: ResolvedVisualState,
): ResolvedVisualState | null {
  const targetOutput = state.outputs[targetState.outputId];
  const preset = state.presetRegistry[targetState.presetId] || state.presetRegistry[targetOutput?.presetId || ''];
  if (!targetOutput || !preset) {
    return null;
  }

  const currentFeelingUniforms: UniformValueMap = {};
  const currentExpressiveUniforms: UniformValueMap = {};

  Object.keys(targetState.feelingUniforms).forEach((key) => {
    const currentValue = state.feelingUniforms[key];
    if (currentValue !== undefined) {
      currentFeelingUniforms[key] = cloneUniformValue(currentValue);
    }
  });

  Object.keys(targetState.expressiveUniforms).forEach((key) => {
    const currentValue = targetOutput.uniforms[key] ?? preset.defaultUniforms[key];
    if (currentValue !== undefined) {
      currentExpressiveUniforms[key] = cloneUniformValue(currentValue);
    }
  });

  return {
    recipeId: targetState.recipeId,
    recipeLabel: targetState.recipeLabel,
    outputId: targetState.outputId,
    presetId: preset.id,
    feelingUniforms: currentFeelingUniforms,
    expressiveUniforms: currentExpressiveUniforms,
  };
}

function evaluateVisualStateEasing(
  progress: number,
  easing: VisualStateTransitionEasing,
): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  if (easing === 'easeOut') {
    return 1 - ((1 - clampedProgress) * (1 - clampedProgress));
  }

  if (easing === 'easeInOut') {
    return 0.5 - (Math.cos(clampedProgress * Math.PI) * 0.5);
  }

  return clampedProgress;
}

function interpolateUniformBucket(
  fromBucket: UniformValueMap,
  toBucket: UniformValueMap,
  t: number,
  schemaMap?: Record<string, UniformSchemaField>,
): UniformValueMap {
  const nextBucket: UniformValueMap = {};
  const keys = new Set([
    ...Object.keys(fromBucket),
    ...Object.keys(toBucket),
  ]);

  keys.forEach((key) => {
    const fromValue = fromBucket[key];
    const toValue = toBucket[key];
    if (typeof fromValue !== 'number' || typeof toValue !== 'number') {
      const fallbackValue = toValue ?? fromValue;
      if (fallbackValue !== undefined) {
        nextBucket[key] = cloneUniformValue(fallbackValue);
      }
      return;
    }

    const interpolatedValue = fromValue + ((toValue - fromValue) * t);
    const field = schemaMap?.[key];
    if (!field) {
      nextBucket[key] = interpolatedValue;
      return;
    }

    const validationResult = validateUniformValue(field, interpolatedValue);
    nextBucket[key] = validationResult.ok && validationResult.value !== undefined
      ? validationResult.value
      : interpolatedValue;
  });

  return nextBucket;
}

function validateVisualIntentShape(intent: VisualIntent): string[] {
  const errors: string[] = [];
  const unknownKeys = Object.keys(intent as Record<string, unknown>).filter((key) => !VISUAL_INTENT_KEYS.has(key));

  if (unknownKeys.length > 0) {
    errors.push(`Unknown visual intent fields: ${unknownKeys.join(', ')}.`);
  }

  if (typeof intent.targetOutputId !== 'string' || intent.targetOutputId.trim().length === 0) {
    errors.push('Visual intent requires a targetOutputId string.');
  }

  if (intent.preset !== undefined && typeof intent.preset !== 'string') {
    errors.push('Visual intent preset must be a string when provided.');
  }

  if (
    intent.uniforms !== undefined
    && (typeof intent.uniforms !== 'object' || intent.uniforms === null || Array.isArray(intent.uniforms))
  ) {
    errors.push('Visual intent uniforms must be an object when provided.');
  }

  return errors;
}

function applyVisualIntentMutation(
  state: ShaderMasterStoreState,
  intent: VisualIntent,
): {
  nextOutputs?: Record<string, ShaderOutput>;
  nextAudioUniforms?: UniformValueMap;
  nextFeelingUniforms?: UniformValueMap;
  result: VisualIntentResult;
} {
  const shapeErrors = validateVisualIntentShape(intent);
  if (shapeErrors.length > 0) {
    return {
      result: {
        ok: false,
        errors: shapeErrors,
      },
    };
  }

  const targetOutput = state.outputs[intent.targetOutputId];
  if (!targetOutput) {
    return {
      result: {
        ok: false,
        errors: [`Unknown target output: ${intent.targetOutputId}.`],
      },
    };
  }

  const nextPreset = intent.preset
    ? state.presetRegistry[intent.preset]
    : state.presetRegistry[targetOutput.presetId];

  if (!nextPreset) {
    return {
      result: {
        ok: false,
        errors: [`Unknown preset: ${intent.preset || targetOutput.presetId}.`],
      },
    };
  }

  const nextOutput: ShaderOutput = {
    ...targetOutput,
    presetId: nextPreset.id,
    uniforms: intent.preset
      ? remapUniformsForPreset(nextPreset, targetOutput.uniforms)
      : cloneUniformMap(targetOutput.uniforms),
  };
  const nextAudioUniforms = cloneUniformMap(state.audioUniforms);
  const nextFeelingUniforms = cloneUniformMap(state.feelingUniforms);

  const schemaMap = schemaToMap(nextPreset.uniformSchema);
  const errors: string[] = [];

  Object.entries(intent.uniforms || {}).forEach(([key, value]) => {
    const field = schemaMap[key];
    if (!field) {
      errors.push(`Unknown uniform key for preset ${nextPreset.id}: ${key}.`);
      return;
    }

    const validationResult = coerceAndValidateUniform(field, value);
    if (!validationResult.ok || validationResult.normalizedValue === undefined) {
      errors.push(...validationResult.errors);
      return;
    }

    if (field.source === 'runtime') {
      errors.push(`${key} is runtime-managed and cannot be changed through visual intent.`);
      return;
    }

    if (field.source === 'audio') {
      nextAudioUniforms[key] = cloneUniformValue(validationResult.normalizedValue);
      return;
    }

    if (field.source === 'feeling') {
      nextFeelingUniforms[key] = cloneUniformValue(validationResult.normalizedValue);
      return;
    }

    nextOutput.uniforms[key] = cloneUniformValue(validationResult.normalizedValue);
  });

  if (errors.length > 0) {
    return {
      result: {
        ok: false,
        errors,
      },
    };
  }

  return {
    nextOutputs: {
      ...state.outputs,
      [nextOutput.id]: nextOutput,
    },
    nextAudioUniforms,
    nextFeelingUniforms,
    result: {
      ok: true,
      errors: [],
    },
  };
}

export function createShaderMasterStore(): ShaderMasterStore {
  const registry = presetRegistry;
  const initialOutputs = buildInitialOutputs(registry);
  const initialOutput = initialOutputs[DEFAULT_OUTPUT_ID];

  return createStore<ShaderMasterStoreState>((set, get) => ({
    presetRegistry: registry,
    outputs: initialOutputs,
    outputOrder: initialOutput ? [DEFAULT_OUTPUT_ID] : [],
    surfaces: [],
    surfaceAssignments: {},
    selectedOutputId: initialOutput?.id || null,
    selectedSurfaceId: null,
    runtimeUniforms: buildRuntimeDefaults(),
    audioUniforms: buildAudioDefaults(),
    audioVisualMapping: createDefaultAudioVisualMappingState(),
    feelingUniforms: buildFeelingDefaults(),
    currentVisualState: null,
    targetVisualState: null,
    activeVisualStateTransition: null,
    uiRevision: 0,
    outputCounter: 1,

    createOutput: (presetId, name) => {
      const state = get();
      const preset = getPresetOrFallback(state.presetRegistry, presetId);
      if (!preset) {
        return null;
      }

      const outputId = getNextOutputId(state);
      const outputName = getUniqueOutputName(
        state.outputs,
        normalizeName(name, preset.label),
      );
      const output = createOutputRecord(outputId, outputName, preset);

      set({
        outputs: {
          ...state.outputs,
          [outputId]: output,
        },
        outputOrder: [...state.outputOrder, outputId],
        selectedOutputId: outputId,
        outputCounter: Number.parseInt(outputId.replace('output-', ''), 10) || state.outputCounter + 1,
        uiRevision: incrementUiRevision(state),
      });

      return output;
    },

    duplicateOutput: (outputId) => {
      const state = get();
      const sourceOutput = state.outputs[outputId];
      if (!sourceOutput) {
        return null;
      }

      const nextOutputId = getNextOutputId(state);
      const duplicatedOutput: ShaderOutput = {
        ...sourceOutput,
        id: nextOutputId,
        name: getUniqueOutputName(state.outputs, `${sourceOutput.name} Copy`),
        uniforms: cloneUniformMap(sourceOutput.uniforms),
      };
      const sourceIndex = state.outputOrder.indexOf(outputId);
      const nextOrder = [...state.outputOrder];
      nextOrder.splice(sourceIndex + 1, 0, nextOutputId);

      set({
        outputs: {
          ...state.outputs,
          [nextOutputId]: duplicatedOutput,
        },
        outputOrder: nextOrder,
        selectedOutputId: nextOutputId,
        outputCounter: Number.parseInt(nextOutputId.replace('output-', ''), 10) || state.outputCounter + 1,
        uiRevision: incrementUiRevision(state),
      });

      return duplicatedOutput;
    },

    deleteOutput: (outputId) => {
      const state = get();
      if (!state.outputs[outputId]) {
        return false;
      }

      const { [outputId]: _removedOutput, ...remainingOutputs } = state.outputs;
      const nextOutputOrder = state.outputOrder.filter((id) => id !== outputId);
      const nextSurfaceAssignments = Object.fromEntries(
        Object.entries(state.surfaceAssignments).map(([surfaceId, assignedOutputId]) => [
          surfaceId,
          assignedOutputId === outputId ? null : assignedOutputId,
        ]),
      ) as Record<string, string | null>;
      const nextSurfaces = state.surfaces.map((surface) => ({
        ...surface,
        assignedOutputId: nextSurfaceAssignments[surface.id] ?? null,
      }));
      const shouldClearVisualState = isVisualStateTargetingOutput(state, outputId);

      set({
        outputs: remainingOutputs,
        outputOrder: nextOutputOrder,
        selectedOutputId:
          state.selectedOutputId === outputId
            ? nextOutputOrder[0] || null
            : state.selectedOutputId,
        surfaceAssignments: nextSurfaceAssignments,
        surfaces: nextSurfaces,
        ...(shouldClearVisualState ? clearVisualStateStoreFields() : {}),
        uiRevision: incrementUiRevision(state),
      });

      return true;
    },

    renameOutput: (outputId, name) => {
      const state = get();
      const output = state.outputs[outputId];
      if (!output) {
        return false;
      }

      const nextName = normalizeName(name, output.name);
      if (nextName === output.name) {
        return true;
      }

      set({
        outputs: {
          ...state.outputs,
          [outputId]: {
            ...output,
            name: nextName,
          },
        },
        uiRevision: incrementUiRevision(state),
      });

      return true;
    },

    setOutputEnabled: (outputId, enabled) => {
      const state = get();
      const output = state.outputs[outputId];
      if (!output || output.enabled === enabled) {
        return Boolean(output);
      }

      set({
        outputs: {
          ...state.outputs,
          [outputId]: {
            ...output,
            enabled,
          },
        },
        uiRevision: incrementUiRevision(state),
      });

      return true;
    },

    changeOutputPreset: (outputId, presetId) => {
      const state = get();
      const output = state.outputs[outputId];
      const preset = state.presetRegistry[presetId];
      if (!output || !preset) {
        return false;
      }

      const nextOutput: ShaderOutput = {
        ...output,
        presetId: preset.id,
        uniforms: remapUniformsForPreset(preset, output.uniforms),
      };

      set({
        outputs: {
          ...state.outputs,
          [outputId]: nextOutput,
        },
        selectedOutputId: outputId,
        ...(isVisualStateTargetingOutput(state, outputId) ? clearVisualStateStoreFields() : {}),
        uiRevision: incrementUiRevision(state),
      });

      return true;
    },

    updateOutputUniform: (outputId, key, value) => {
      const state = get();
      const output = state.outputs[outputId];
      if (!output) {
        return {
          ok: false,
          errors: [`Unknown output: ${outputId}.`],
        };
      }

      const preset = state.presetRegistry[output.presetId];
      const field = preset?.uniformSchema.find((schemaField) => schemaField.key === key);
      if (!preset || !field) {
        return {
          ok: false,
          errors: [`Unknown uniform key for preset ${output.presetId}: ${key}.`],
        };
      }

      if (field.source !== 'manual') {
        return {
          ok: false,
          errors: [`${key} is ${field.source}-driven and cannot be edited as an output override.`],
        };
      }

      const validationResult = coerceAndValidateUniform(field, value);
      if (!validationResult.ok || validationResult.normalizedValue === undefined) {
        return validationResult;
      }
      const shouldClearVisualState = isVisualStateManagedUniformKey(state, outputId, key);

      set({
        outputs: {
          ...state.outputs,
          [outputId]: {
            ...output,
            uniforms: {
              ...output.uniforms,
              [key]: cloneUniformValue(validationResult.normalizedValue),
            },
          },
        },
        selectedOutputId: outputId,
        ...(shouldClearVisualState ? clearVisualStateStoreFields() : {}),
        uiRevision: incrementUiRevision(state),
      });

      return {
        ok: true,
        errors: [],
      };
    },

    assignOutputToSurface: (surfaceId, outputId) => {
      const state = get();
      const surfaceExists = state.surfaces.some((surface) => surface.id === surfaceId);
      if (!surfaceExists) {
        return false;
      }

      if (outputId !== null && !state.outputs[outputId]) {
        return false;
      }

      const nextSurfaceAssignments = {
        ...state.surfaceAssignments,
        [surfaceId]: outputId,
      };
      const nextSurfaces = state.surfaces.map((surface) => (
        surface.id === surfaceId
          ? {
              ...surface,
              assignedOutputId: outputId,
            }
          : surface
      ));

      set({
        surfaceAssignments: nextSurfaceAssignments,
        surfaces: nextSurfaces,
        selectedSurfaceId: surfaceId,
        uiRevision: incrementUiRevision(state),
      });

      return true;
    },

    syncSurfaces: (surfaces) => {
      const state = get();
      const sortedSurfaces = [...surfaces].sort((left, right) => {
        if (left.order !== right.order) {
          return left.order - right.order;
        }

        return left.id.localeCompare(right.id);
      });

      const nextSurfaceAssignments = sortedSurfaces.reduce<Record<string, string | null>>((accumulator, surface) => {
        accumulator[surface.id] = state.surfaceAssignments[surface.id] ?? surface.assignedOutputId ?? null;
        return accumulator;
      }, {});

      const nextSurfaces = sortedSurfaces.map((surface) => ({
        ...surface,
        assignedOutputId: nextSurfaceAssignments[surface.id] ?? null,
      }));

      const hasSelectedSurface = state.selectedSurfaceId
        ? nextSurfaces.some((surface) => surface.id === state.selectedSurfaceId)
        : false;

      set({
        surfaces: nextSurfaces,
        surfaceAssignments: nextSurfaceAssignments,
        selectedSurfaceId: hasSelectedSurface ? state.selectedSurfaceId : nextSurfaces[0]?.id || null,
        uiRevision: incrementUiRevision(state),
      });
    },

    setSelectedOutput: (outputId) => {
      const state = get();
      if (outputId !== null && !state.outputs[outputId]) {
        return;
      }
      if (state.selectedOutputId === outputId) {
        return;
      }

      set({
        selectedOutputId: outputId,
        uiRevision: incrementUiRevision(state),
      });
    },

    setSelectedSurface: (surfaceId) => {
      const state = get();
      if (surfaceId !== null && !state.surfaces.some((surface) => surface.id === surfaceId)) {
        return;
      }
      if (state.selectedSurfaceId === surfaceId) {
        return;
      }

      set({
        selectedSurfaceId: surfaceId,
        uiRevision: incrementUiRevision(state),
      });
    },

    setRuntimeUniforms: (uniforms) => {
      const state = get();
      set({
        runtimeUniforms: mergeUniformBucket(state.runtimeUniforms, uniforms, 'runtime'),
      });
    },

    setAudioUniforms: (uniforms, options = {}) => {
      const state = get();
      const shouldUpdateUiRevision = options.updateUiRevision !== false;
      set({
        audioUniforms: mergeUniformBucket(state.audioUniforms, uniforms, 'audio'),
        ...(shouldUpdateUiRevision ? { uiRevision: incrementUiRevision(state) } : {}),
      });
    },

    setAudioVisualSignalTuning: (key, patch) => {
      const state = get();
      const currentSignal = state.audioVisualMapping.signals[key];
      if (!currentSignal) {
        return;
      }

      const nextSignal = sanitizeAudioVisualSignalTuning(patch, currentSignal);
      set({
        audioVisualMapping: {
          ...state.audioVisualMapping,
          signals: {
            ...state.audioVisualMapping.signals,
            [key]: nextSignal,
          },
        },
        uiRevision: incrementUiRevision(state),
      });
    },

    setAudioVisualSoloKey: (key) => {
      const state = get();
      if (state.audioVisualMapping.soloKey === key) {
        return;
      }

      set({
        audioVisualMapping: {
          ...state.audioVisualMapping,
          soloKey: key,
        },
        uiRevision: incrementUiRevision(state),
      });
    },

    resetAudioVisualMapping: () => {
      const state = get();
      set({
        audioVisualMapping: createDefaultAudioVisualMappingState(),
        uiRevision: incrementUiRevision(state),
      });
    },

    setFeelingUniforms: (uniforms) => {
      const state = get();
      set({
        feelingUniforms: mergeUniformBucket(state.feelingUniforms, uniforms, 'feeling'),
        ...clearVisualStateStoreFields(),
        uiRevision: incrementUiRevision(state),
      });
    },

    resetAudioUniforms: () => {
      const state = get();
      set({
        audioUniforms: buildAudioDefaults(),
        uiRevision: incrementUiRevision(state),
      });
    },

    resetFeelingUniforms: () => {
      const state = get();
      set({
        feelingUniforms: buildFeelingDefaults(),
        ...clearVisualStateStoreFields(),
        uiRevision: incrementUiRevision(state),
      });
    },

    resetAllDebugSignals: () => {
      const state = get();
      set({
        audioUniforms: buildAudioDefaults(),
        audioVisualMapping: createDefaultAudioVisualMappingState(),
        feelingUniforms: buildFeelingDefaults(),
        ...clearVisualStateStoreFields(),
        uiRevision: incrementUiRevision(state),
      });
    },

    applyVisualStateRecipe: (recipe) => {
      const state = get();
      const resolution = resolveVisualStateRecipe({
        recipe,
        outputs: state.outputs,
        outputOrder: state.outputOrder,
        selectedOutputId: state.selectedOutputId,
        presetRegistry: state.presetRegistry,
      });

      if (!resolution.ok || !resolution.resolved) {
        return {
          ok: false,
          errors: resolution.errors,
          warnings: resolution.warnings,
        };
      }

      const transitionResult = get().setTargetVisualState(
        resolution.resolved.state,
        resolution.resolved.transition,
      );

      return {
        ok: transitionResult.ok,
        errors: transitionResult.errors,
        warnings: [...resolution.warnings, ...transitionResult.warnings],
      };
    },

    setTargetVisualState: (targetState, transition) => {
      const state = get();
      const targetOutput = state.outputs[targetState.outputId];
      const preset = state.presetRegistry[targetState.presetId];

      if (!targetOutput) {
        return {
          ok: false,
          errors: [`Unknown target output: ${targetState.outputId}.`],
          warnings: [],
        };
      }

      if (!preset) {
        return {
          ok: false,
          errors: [`Unknown preset: ${targetState.presetId}.`],
          warnings: [],
        };
      }

      const remappedOutput = targetOutput.presetId === preset.id
        ? targetOutput
        : {
            ...targetOutput,
            presetId: preset.id,
            uniforms: remapUniformsForPreset(preset, targetOutput.uniforms),
          };
      const workingOutputs = targetOutput.presetId === preset.id
        ? state.outputs
        : {
            ...state.outputs,
            [targetState.outputId]: remappedOutput,
          };
      const workingState = {
        ...state,
        outputs: workingOutputs,
      };
      const currentVisualState = captureCurrentVisualState(workingState, targetState);

      if (!currentVisualState) {
        return {
          ok: false,
          errors: ['Unable to capture the current visual state for this recipe target.'],
          warnings: [],
        };
      }

      if (transition.mode === 'immediate' || transition.durationMs <= 0) {
        const appliedMutation = applyResolvedVisualStateMutation(workingState, targetState);
        set({
          outputs: appliedMutation.nextOutputs,
          feelingUniforms: appliedMutation.nextFeelingUniforms,
          currentVisualState: cloneResolvedVisualState(targetState),
          targetVisualState: cloneResolvedVisualState(targetState),
          activeVisualStateTransition: null,
          selectedOutputId: targetState.outputId,
          uiRevision: incrementUiRevision(state),
        });

        return {
          ok: true,
          errors: [],
          warnings: [],
        };
      }

      set({
        outputs: workingOutputs,
        currentVisualState,
        targetVisualState: cloneResolvedVisualState(targetState),
        activeVisualStateTransition: {
          recipeId: targetState.recipeId,
          recipeLabel: targetState.recipeLabel,
          outputId: targetState.outputId,
          presetId: targetState.presetId,
          durationMs: transition.durationMs,
          easing: transition.easing,
          elapsedMs: 0,
          fromState: cloneResolvedVisualState(currentVisualState) as ResolvedVisualState,
        },
        selectedOutputId: targetState.outputId,
        uiRevision: incrementUiRevision(state),
      });

      return {
        ok: true,
        errors: [],
        warnings: [],
      };
    },

    advanceVisualStateTransition: (deltaTimeMs) => {
      const state = get();
      const transition = state.activeVisualStateTransition;
      const targetState = state.targetVisualState;

      if (!transition || !targetState || deltaTimeMs <= 0) {
        return;
      }

      const targetOutput = state.outputs[targetState.outputId];
      const preset = state.presetRegistry[targetState.presetId];
      if (!targetOutput || !preset) {
        set({
          ...clearVisualStateStoreFields(),
          uiRevision: incrementUiRevision(state),
        });
        return;
      }

      const nextElapsedMs = Math.min(
        transition.durationMs,
        transition.elapsedMs + Math.max(0, deltaTimeMs),
      );
      const progress = transition.durationMs <= 0 ? 1 : nextElapsedMs / transition.durationMs;
      const easedProgress = evaluateVisualStateEasing(progress, transition.easing);
      const schemaMap = schemaToMap(preset.uniformSchema);
      const nextCurrentState: ResolvedVisualState = {
        recipeId: targetState.recipeId,
        recipeLabel: targetState.recipeLabel,
        outputId: targetState.outputId,
        presetId: targetState.presetId,
        feelingUniforms: interpolateUniformBucket(
          transition.fromState.feelingUniforms,
          targetState.feelingUniforms,
          easedProgress,
        ),
        expressiveUniforms: interpolateUniformBucket(
          transition.fromState.expressiveUniforms,
          targetState.expressiveUniforms,
          easedProgress,
          schemaMap,
        ),
      };
      const appliedMutation = applyResolvedVisualStateMutation(state, nextCurrentState);
      const isComplete = nextElapsedMs >= transition.durationMs;

      set({
        outputs: appliedMutation.nextOutputs,
        feelingUniforms: appliedMutation.nextFeelingUniforms,
        currentVisualState: isComplete
          ? cloneResolvedVisualState(targetState)
          : nextCurrentState,
        targetVisualState: cloneResolvedVisualState(targetState),
        activeVisualStateTransition: isComplete
          ? null
          : {
              ...transition,
              elapsedMs: nextElapsedMs,
            },
        ...(isComplete ? { uiRevision: incrementUiRevision(state) } : {}),
      });
    },

    resetVisualStateRecipeState: () => {
      const state = get();
      if (!state.currentVisualState && !state.targetVisualState && !state.activeVisualStateTransition) {
        return;
      }

      set({
        ...clearVisualStateStoreFields(),
        uiRevision: incrementUiRevision(state),
      });
    },

    hydrateSnapshot: (snapshot) => {
      const nextOutputs = snapshot.outputs.reduce<Record<string, ShaderOutput>>((accumulator, output) => {
        accumulator[output.id] = {
          id: output.id,
          name: output.name,
          presetId: output.presetId,
          uniforms: cloneUniformMap(output.uniforms),
          enabled: output.enabled,
        };
        return accumulator;
      }, {});

      set({
        outputs: nextOutputs,
        outputOrder: snapshot.outputs.map((output) => output.id),
        surfaces: snapshot.surfaces.map((surface) => ({ ...surface })),
        surfaceAssignments: { ...snapshot.surfaceAssignments },
        selectedOutputId: snapshot.selectedOutputId,
        selectedSurfaceId: snapshot.selectedSurfaceId,
        runtimeUniforms: cloneUniformMap(snapshot.runtimeUniforms),
        audioUniforms: cloneUniformMap(snapshot.audioUniforms),
        audioVisualMapping: cloneAudioVisualMappingState(snapshot.audioVisualMapping),
        feelingUniforms: cloneUniformMap(snapshot.feelingUniforms),
        currentVisualState: snapshot.visualState
          ? cloneResolvedVisualState(snapshot.visualState.current)
          : null,
        targetVisualState: snapshot.visualState
          ? cloneResolvedVisualState(snapshot.visualState.target)
          : null,
        activeVisualStateTransition: snapshot.visualState
          ? cloneVisualStateRuntimeSnapshot(snapshot.visualState).transition
          : null,
        uiRevision: snapshot.revision,
        outputCounter: Math.max(
          1,
          ...snapshot.outputs.map((output) => Number.parseInt(output.id.replace('output-', ''), 10) || 1),
        ),
      });
    },

    applyVisualIntent: (intent) => {
      const state = get();
      const {
        nextOutputs,
        nextAudioUniforms,
        nextFeelingUniforms,
        result,
      } = applyVisualIntentMutation(state, intent);

      if (!result.ok || !nextOutputs) {
        return result;
      }
      const shouldClearVisualState = isVisualStateTargetingOutput(state, intent.targetOutputId)
        || nextFeelingUniforms !== undefined;

      set({
        outputs: nextOutputs,
        audioUniforms: nextAudioUniforms || state.audioUniforms,
        feelingUniforms: nextFeelingUniforms || state.feelingUniforms,
        selectedOutputId: intent.targetOutputId,
        ...(shouldClearVisualState ? clearVisualStateStoreFields() : {}),
        uiRevision: incrementUiRevision(state),
      });

      return result;
    },
  }));
}

export function createShaderMasterSnapshot(
  state: ShaderMasterStoreState,
): ShaderMasterSnapshot {
  const mappedAudioUniforms = buildMappedAudioUniforms(state);
  return {
    revision: state.uiRevision,
    presets: listPresetCatalog(),
    outputs: buildOrderedOutputs(state).map((output) => buildOutputSnapshot(state, output)),
    surfaces: state.surfaces.map((surface) => ({ ...surface })),
    surfaceAssignments: { ...state.surfaceAssignments },
    selectedOutputId: state.selectedOutputId,
    selectedSurfaceId: state.selectedSurfaceId,
    runtimeUniforms: cloneUniformMap(state.runtimeUniforms),
    audioUniforms: cloneUniformMap(state.audioUniforms),
    mappedAudioUniforms,
    audioVisualMapping: cloneAudioVisualMappingState(state.audioVisualMapping),
    feelingUniforms: cloneUniformMap(state.feelingUniforms),
    visualState: buildVisualStateSnapshot(state),
  };
}
