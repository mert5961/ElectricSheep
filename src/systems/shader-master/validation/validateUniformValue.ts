import { getVectorLength, isVectorType } from '../contracts/uniforms.ts';
import type { ShaderUniformValue, UniformSchemaField } from '../contracts/types.ts';
import { clampUniformValue } from './clampUniformValue.ts';

export interface UniformValidationResult {
  ok: boolean;
  value?: ShaderUniformValue;
  error?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateUniformValue(
  field: UniformSchemaField,
  value: unknown,
): UniformValidationResult {
  if (field.type === 'bool') {
    if (typeof value !== 'boolean') {
      return {
        ok: false,
        error: `${field.key} expects a boolean value.`,
      };
    }

    return {
      ok: true,
      value,
    };
  }

  if (field.type === 'float' || field.type === 'int') {
    if (!isFiniteNumber(value)) {
      return {
        ok: false,
        error: `${field.key} expects a finite numeric value.`,
      };
    }

    return {
      ok: true,
      value: clampUniformValue(field, value),
    };
  }

  if (isVectorType(field.type)) {
    const expectedLength = getVectorLength(field.type);
    if (!Array.isArray(value) || value.length !== expectedLength) {
      return {
        ok: false,
        error: `${field.key} expects an array of length ${expectedLength}.`,
      };
    }

    if (!value.every((component) => isFiniteNumber(component))) {
      return {
        ok: false,
        error: `${field.key} expects only finite numeric vector components.`,
      };
    }

    return {
      ok: true,
      value: clampUniformValue(field, value as ShaderUniformValue),
    };
  }

  return {
    ok: false,
    error: `${field.key} uses an unsupported uniform type.`,
  };
}
