import { cloneUniformMap, cloneUniformValue, schemaToMap } from '../contracts/uniforms.ts';
import type {
  ShaderOutput,
  ShaderPresetDefinition,
  UniformValueMap,
} from '../contracts/types.ts';
import type { ShaderMasterAIState } from '../contracts/aiState.ts';

export interface ResolveFinalUniformsOptions {
  preset: ShaderPresetDefinition;
  output: ShaderOutput;
  runtimeUniforms: UniformValueMap;
  audioUniforms: UniformValueMap;
  feelingUniforms: UniformValueMap;
  aiState?: ShaderMasterAIState | null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildEffectiveFeelingUniforms(
  feelingUniforms: UniformValueMap,
  aiState: ShaderMasterAIState | null | undefined,
): UniformValueMap {
  const nextFeelingUniforms = cloneUniformMap(feelingUniforms);

  if (!aiState?.aiEnabled) {
    return nextFeelingUniforms;
  }

  // The current shader system does not yet expose a dedicated flow uniform,
  // so flow bias is translated into the inverse stillness control for now.
  nextFeelingUniforms.u_feelGlow = aiState.currentAIState.glow;
  nextFeelingUniforms.u_feelWarmth = aiState.currentAIState.warmth;
  nextFeelingUniforms.u_feelFragmentation = aiState.currentAIState.fragmentation;
  nextFeelingUniforms.u_feelStillness = clamp01(1 - aiState.currentAIState.flowBias);

  return nextFeelingUniforms;
}

export function resolveFinalUniforms({
  preset,
  output,
  runtimeUniforms,
  audioUniforms,
  feelingUniforms,
  aiState = null,
}: ResolveFinalUniformsOptions): UniformValueMap {
  const schemaMap = schemaToMap(preset.uniformSchema);
  const resolved = cloneUniformMap(preset.defaultUniforms);
  const effectiveFeelingUniforms = buildEffectiveFeelingUniforms(feelingUniforms, aiState);

  Object.entries(output.uniforms).forEach(([key, value]) => {
    if (schemaMap[key]) {
      resolved[key] = cloneUniformValue(value);
    }
  });

  preset.uniformSchema.forEach((field) => {
    const sourceValue =
      field.source === 'runtime'
        ? runtimeUniforms[field.key]
        : field.source === 'audio'
          ? audioUniforms[field.key]
          : field.source === 'feeling'
            ? effectiveFeelingUniforms[field.key]
            : undefined;

    if (sourceValue !== undefined) {
      resolved[field.key] = cloneUniformValue(sourceValue);
    } else if (resolved[field.key] === undefined) {
      resolved[field.key] = cloneUniformValue(field.defaultValue);
    }
  });

  return resolved;
}
