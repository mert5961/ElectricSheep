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
import { listPresetCatalog, presetRegistry } from '../registry/presetRegistry.ts';
import { resolveFinalUniforms } from '../runtime/resolveFinalUniforms.ts';
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
  feelingUniforms: UniformValueMap;
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
  setAudioUniforms: (uniforms: Partial<UniformValueMap>) => void;
  setFeelingUniforms: (uniforms: Partial<UniformValueMap>) => void;
  hydrateSnapshot: (snapshot: ShaderMasterSnapshot) => void;
  applyVisualIntent: (intent: VisualIntent) => VisualIntentResult;
}

export type ShaderMasterStore = StoreApi<ShaderMasterStoreState>;

const DEFAULT_OUTPUT_ID = 'output-main';
const DEFAULT_OUTPUT_NAME = 'Main Output';

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

function buildOutputSnapshot(
  state: ShaderMasterStoreState,
  output: ShaderOutput,
): ShaderOutputSnapshot {
  const preset = state.presetRegistry[output.presetId];
  return {
    ...output,
    uniforms: cloneUniformMap(output.uniforms),
    presetLabel: preset?.label || output.presetId,
    resolvedUniforms: preset
      ? resolveFinalUniforms({
          preset,
          output,
          runtimeUniforms: state.runtimeUniforms,
          audioUniforms: state.audioUniforms,
          feelingUniforms: state.feelingUniforms,
        })
      : cloneUniformMap(output.uniforms),
  };
}

function applyVisualIntentMutation(
  state: ShaderMasterStoreState,
  intent: VisualIntent,
): { nextOutputs?: Record<string, ShaderOutput>; result: VisualIntentResult } {
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
    feelingUniforms: buildFeelingDefaults(),
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

      set({
        outputs: remainingOutputs,
        outputOrder: nextOutputOrder,
        selectedOutputId:
          state.selectedOutputId === outputId
            ? nextOutputOrder[0] || null
            : state.selectedOutputId,
        surfaceAssignments: nextSurfaceAssignments,
        surfaces: nextSurfaces,
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

      const validationResult = coerceAndValidateUniform(field, value);
      if (!validationResult.ok || validationResult.normalizedValue === undefined) {
        return validationResult;
      }

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

    setAudioUniforms: (uniforms) => {
      const state = get();
      set({
        audioUniforms: mergeUniformBucket(state.audioUniforms, uniforms, 'audio'),
        uiRevision: incrementUiRevision(state),
      });
    },

    setFeelingUniforms: (uniforms) => {
      const state = get();
      set({
        feelingUniforms: mergeUniformBucket(state.feelingUniforms, uniforms, 'feeling'),
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
        feelingUniforms: cloneUniformMap(snapshot.feelingUniforms),
        uiRevision: snapshot.revision,
        outputCounter: Math.max(
          1,
          ...snapshot.outputs.map((output) => Number.parseInt(output.id.replace('output-', ''), 10) || 1),
        ),
      });
    },

    applyVisualIntent: (intent) => {
      const state = get();
      const { nextOutputs, result } = applyVisualIntentMutation(state, intent);

      if (!result.ok || !nextOutputs) {
        return result;
      }

      set({
        outputs: nextOutputs,
        selectedOutputId: intent.targetOutputId,
        uiRevision: incrementUiRevision(state),
      });

      return result;
    },
  }));
}

export function createShaderMasterSnapshot(
  state: ShaderMasterStoreState,
): ShaderMasterSnapshot {
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
    feelingUniforms: cloneUniformMap(state.feelingUniforms),
  };
}
