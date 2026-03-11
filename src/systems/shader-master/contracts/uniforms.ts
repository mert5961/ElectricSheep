import type {
  ShaderUniformValue,
  UniformSchema,
  UniformSchemaField,
  UniformType,
  UniformValueMap,
  Vec2Value,
  Vec3Value,
  Vec4Value,
} from './types.ts';

const DEFAULT_COLOR_A: Vec3Value = [0.12, 0.56, 0.96];
const DEFAULT_COLOR_B: Vec3Value = [1.0, 0.48, 0.18];

function floatField(
  key: string,
  label: string,
  source: UniformSchemaField['source'],
  defaultValue: number,
  options: Partial<UniformSchemaField> = {},
): UniformSchemaField {
  return {
    key,
    label,
    type: 'float',
    source,
    defaultValue,
    ...options,
  } as UniformSchemaField;
}

function intField(
  key: string,
  label: string,
  source: UniformSchemaField['source'],
  defaultValue: number,
  options: Partial<UniformSchemaField> = {},
): UniformSchemaField {
  return {
    key,
    label,
    type: 'int',
    source,
    defaultValue,
    ...options,
  } as UniformSchemaField;
}

function boolField(
  key: string,
  label: string,
  source: UniformSchemaField['source'],
  defaultValue: boolean,
  options: Partial<UniformSchemaField> = {},
): UniformSchemaField {
  return {
    key,
    label,
    type: 'bool',
    source,
    defaultValue,
    ...options,
  } as UniformSchemaField;
}

function vec2Field(
  key: string,
  label: string,
  source: UniformSchemaField['source'],
  defaultValue: Vec2Value,
  options: Partial<UniformSchemaField> = {},
): UniformSchemaField {
  return {
    key,
    label,
    type: 'vec2',
    source,
    defaultValue,
    ...options,
  } as UniformSchemaField;
}

function vec3Field(
  key: string,
  label: string,
  source: UniformSchemaField['source'],
  defaultValue: Vec3Value,
  options: Partial<UniformSchemaField> = {},
): UniformSchemaField {
  return {
    key,
    label,
    type: 'vec3',
    source,
    defaultValue,
    ...options,
  } as UniformSchemaField;
}

function vec4Field(
  key: string,
  label: string,
  source: UniformSchemaField['source'],
  defaultValue: Vec4Value,
  options: Partial<UniformSchemaField> = {},
): UniformSchemaField {
  return {
    key,
    label,
    type: 'vec4',
    source,
    defaultValue,
    ...options,
  } as UniformSchemaField;
}

export const CORE_UNIFORM_SCHEMA: UniformSchema = [
  floatField('u_time', 'Time', 'runtime', 0, {
    hidden: true,
    description: 'Seconds since render start.',
  }),
  vec2Field('u_resolution', 'Resolution', 'runtime', [1, 1], {
    hidden: true,
    description: 'Render target size in pixels.',
  }),
  floatField('u_audioBass', 'Audio Bass', 'audio', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_audioMid', 'Audio Mid', 'audio', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_audioTreble', 'Audio Treble', 'audio', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_audioEnergy', 'Audio Energy', 'audio', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_audioPulse', 'Audio Pulse', 'audio', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_feelTension', 'Feel Tension', 'feeling', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_feelWarmth', 'Feel Warmth', 'feeling', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_feelFragmentation', 'Feel Fragmentation', 'feeling', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_feelGlow', 'Feel Glow', 'feeling', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_feelStillness', 'Feel Stillness', 'feeling', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_feelDensity', 'Feel Density', 'feeling', 0, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  floatField('u_speed', 'Speed', 'manual', 1, {
    min: 0,
    max: 4,
    step: 0.01,
  }),
  floatField('u_intensity', 'Intensity', 'manual', 1, {
    min: 0,
    max: 3,
    step: 0.01,
  }),
  vec3Field('u_colorA', 'Color A', 'manual', DEFAULT_COLOR_A, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
  vec3Field('u_colorB', 'Color B', 'manual', DEFAULT_COLOR_B, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
];

export const CORE_UNIFORM_SCHEMA_MAP = schemaToMap(CORE_UNIFORM_SCHEMA);

export const SHARED_FRAGMENT_UNIFORMS = `
uniform float u_time;
uniform vec2 u_resolution;

uniform float u_audioBass;
uniform float u_audioMid;
uniform float u_audioTreble;
uniform float u_audioEnergy;
uniform float u_audioPulse;

uniform float u_feelTension;
uniform float u_feelWarmth;
uniform float u_feelFragmentation;
uniform float u_feelGlow;
uniform float u_feelStillness;
uniform float u_feelDensity;

uniform float u_speed;
uniform float u_intensity;
uniform vec3 u_colorA;
uniform vec3 u_colorB;

varying vec2 v_uv;
`;

export const SHARED_SHADER_UTILS = `
const float PI = 3.141592653589793;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(4.2, 2.8);
    amplitude *= 0.5;
  }
  return value;
}
`;

export function cloneUniformValue<TValue extends ShaderUniformValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    return [...value] as TValue;
  }

  return value;
}

export function cloneUniformMap(uniforms: UniformValueMap): UniformValueMap {
  const next: UniformValueMap = {};

  Object.entries(uniforms).forEach(([key, value]) => {
    next[key] = cloneUniformValue(value);
  });

  return next;
}

export function createDefaultUniforms(
  schema: UniformSchema,
  overrides: Partial<UniformValueMap> = {},
): UniformValueMap {
  const defaults: UniformValueMap = {};

  schema.forEach((field) => {
    defaults[field.key] = cloneUniformValue(field.defaultValue);
  });

  Object.entries(overrides).forEach(([key, value]) => {
    if (value !== undefined) {
      defaults[key] = cloneUniformValue(value);
    }
  });

  return defaults;
}

export function createPresetUniformSchema(extraFields: UniformSchema = []): UniformSchema {
  return [...CORE_UNIFORM_SCHEMA, ...extraFields];
}

export function schemaToMap(schema: UniformSchema): Record<string, UniformSchemaField> {
  return schema.reduce<Record<string, UniformSchemaField>>((accumulator, field) => {
    accumulator[field.key] = field;
    return accumulator;
  }, {});
}

export function getUniformField(
  schema: UniformSchema,
  key: string,
): UniformSchemaField | undefined {
  return schema.find((field) => field.key === key);
}

export function getVectorLength(type: UniformType): number {
  switch (type) {
    case 'vec2':
      return 2;
    case 'vec3':
      return 3;
    case 'vec4':
      return 4;
    default:
      return 1;
  }
}

export function isVectorType(type: UniformType): type is 'vec2' | 'vec3' | 'vec4' {
  return type === 'vec2' || type === 'vec3' || type === 'vec4';
}

export function buildRuntimeDefaults(): UniformValueMap {
  return pickUniformDefaultsBySource(CORE_UNIFORM_SCHEMA, 'runtime');
}

export function buildAudioDefaults(): UniformValueMap {
  return pickUniformDefaultsBySource(CORE_UNIFORM_SCHEMA, 'audio');
}

export function buildFeelingDefaults(): UniformValueMap {
  return pickUniformDefaultsBySource(CORE_UNIFORM_SCHEMA, 'feeling');
}

function pickUniformDefaultsBySource(
  schema: UniformSchema,
  source: UniformSchemaField['source'],
): UniformValueMap {
  return schema.reduce<UniformValueMap>((accumulator, field) => {
    if (field.source === source) {
      accumulator[field.key] = cloneUniformValue(field.defaultValue);
    }

    return accumulator;
  }, {});
}

export {
  boolField,
  floatField,
  intField,
  vec2Field,
  vec3Field,
  vec4Field,
};
