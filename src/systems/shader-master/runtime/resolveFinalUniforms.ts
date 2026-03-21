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

function clampHeadroom(value: number): number {
  return Math.max(0.04, Math.min(0.96, value));
}

function applyCenteredContrast(value: number, amount: number): number {
  return clampHeadroom(0.5 + ((value - 0.5) * amount));
}

export function buildEffectiveFeelingUniforms(
  feelingUniforms: UniformValueMap,
  aiState: ShaderMasterAIState | null | undefined,
): UniformValueMap {
  const nextFeelingUniforms = cloneUniformMap(feelingUniforms);

  if (!aiState?.aiEnabled) {
    return nextFeelingUniforms;
  }

  const aiTension = applyCenteredContrast(aiState.currentAIState.tension, 1.28);
  const aiGlow = applyCenteredContrast(aiState.currentAIState.glow, 1.22);
  const aiWarmth = applyCenteredContrast(aiState.currentAIState.warmth, 1.3);
  const aiFragmentation = applyCenteredContrast(aiState.currentAIState.fragmentation, 1.42);
  const aiStillness = applyCenteredContrast(aiState.currentAIState.stillness, 1.34);
  const flowBiasStillness = clampHeadroom(1 - applyCenteredContrast(aiState.currentAIState.flowBias, 1.18));

  nextFeelingUniforms.u_feelTension = aiTension;
  nextFeelingUniforms.u_feelGlow = aiGlow;
  nextFeelingUniforms.u_feelWarmth = aiWarmth;
  nextFeelingUniforms.u_feelFragmentation = aiFragmentation;
  nextFeelingUniforms.u_feelStillness = clampHeadroom((aiStillness * 0.78) + (flowBiasStillness * 0.22));
  nextFeelingUniforms.u_feelDensity = clamp01(
    (aiFragmentation * 0.38)
    + (aiTension * 0.28)
    + ((1 - flowBiasStillness) * 0.2)
    + (aiGlow * 0.14)
  );

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
