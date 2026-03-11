import { cloneUniformMap, cloneUniformValue, schemaToMap } from '../contracts/uniforms.ts';
import type {
  ShaderOutput,
  ShaderPresetDefinition,
  UniformValueMap,
} from '../contracts/types.ts';

export interface ResolveFinalUniformsOptions {
  preset: ShaderPresetDefinition;
  output: ShaderOutput;
  runtimeUniforms: UniformValueMap;
  audioUniforms: UniformValueMap;
  feelingUniforms: UniformValueMap;
}

export function resolveFinalUniforms({
  preset,
  output,
  runtimeUniforms,
  audioUniforms,
  feelingUniforms,
}: ResolveFinalUniformsOptions): UniformValueMap {
  const schemaMap = schemaToMap(preset.uniformSchema);
  const resolved = cloneUniformMap(preset.defaultUniforms);

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
            ? feelingUniforms[field.key]
            : undefined;

    if (sourceValue !== undefined) {
      resolved[field.key] = cloneUniformValue(sourceValue);
    } else if (resolved[field.key] === undefined) {
      resolved[field.key] = cloneUniformValue(field.defaultValue);
    }
  });

  return resolved;
}
