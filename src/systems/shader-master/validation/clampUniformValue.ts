import { cloneUniformValue, isVectorType } from '../contracts/uniforms.ts';
import type { ShaderUniformValue, UniformSchemaField } from '../contracts/types.ts';

function clampNumber(
  value: number,
  min?: number,
  max?: number,
): number {
  let nextValue = value;

  if (Number.isFinite(min)) {
    nextValue = Math.max(min as number, nextValue);
  }

  if (Number.isFinite(max)) {
    nextValue = Math.min(max as number, nextValue);
  }

  return nextValue;
}

export function clampUniformValue(
  field: UniformSchemaField,
  value: ShaderUniformValue,
): ShaderUniformValue {
  if (field.type === 'bool') {
    return Boolean(value);
  }

  if (field.type === 'float') {
    return clampNumber(value as number, field.min, field.max);
  }

  if (field.type === 'int') {
    return Math.round(clampNumber(value as number, field.min, field.max));
  }

  if (isVectorType(field.type)) {
    const vector = cloneUniformValue(value) as number[];
    return vector.map((component) => clampNumber(component, field.min, field.max)) as ShaderUniformValue;
  }

  return cloneUniformValue(value);
}
