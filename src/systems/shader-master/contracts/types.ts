import type { VisualStateRuntimeSnapshot } from './visualStateRecipe.ts';
import type { AudioVisualMappingState } from './audioVisualMapping.ts';
import type { ShaderMasterAIState } from './aiState.ts';

export type UniformSource = 'manual' | 'runtime' | 'audio' | 'feeling';
export type UniformType = 'float' | 'int' | 'bool' | 'vec2' | 'vec3' | 'vec4';

export type Vec2Value = [number, number];
export type Vec3Value = [number, number, number];
export type Vec4Value = [number, number, number, number];

export type ShaderUniformValue =
  | number
  | boolean
  | Vec2Value
  | Vec3Value
  | Vec4Value;

interface UniformSchemaFieldBase<TType extends UniformType, TValue extends ShaderUniformValue> {
  key: string;
  label: string;
  type: TType;
  source: UniformSource;
  defaultValue: TValue;
  min?: number;
  max?: number;
  step?: number;
  hidden?: boolean;
  description?: string;
}

export type FloatUniformSchemaField = UniformSchemaFieldBase<'float', number>;
export type IntUniformSchemaField = UniformSchemaFieldBase<'int', number>;
export type BoolUniformSchemaField = UniformSchemaFieldBase<'bool', boolean>;
export type Vec2UniformSchemaField = UniformSchemaFieldBase<'vec2', Vec2Value>;
export type Vec3UniformSchemaField = UniformSchemaFieldBase<'vec3', Vec3Value>;
export type Vec4UniformSchemaField = UniformSchemaFieldBase<'vec4', Vec4Value>;

export type UniformSchemaField =
  | FloatUniformSchemaField
  | IntUniformSchemaField
  | BoolUniformSchemaField
  | Vec2UniformSchemaField
  | Vec3UniformSchemaField
  | Vec4UniformSchemaField;

export type UniformSchema = UniformSchemaField[];
export type UniformValueMap = Record<string, ShaderUniformValue>;

export interface ShaderPresetDefinition {
  id: string;
  label: string;
  version: string;
  fragmentShader: string;
  vertexShader?: string;
  uniformSchema: UniformSchema;
  defaultUniforms: UniformValueMap;
  tags?: string[];
}

export interface ShaderOutput {
  id: string;
  name: string;
  presetId: string;
  uniforms: UniformValueMap;
  enabled: boolean;
}

export interface SurfaceReference {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  assignedOutputId: string | null;
}

export interface PresetCatalogEntry {
  id: string;
  label: string;
  version: string;
  uniformSchema: UniformSchema;
  defaultUniforms: UniformValueMap;
  tags?: string[];
}

export interface ShaderOutputSnapshot extends ShaderOutput {
  presetLabel: string;
  resolvedUniforms: UniformValueMap;
}

export interface ShaderMasterSnapshot {
  revision: number;
  presets: PresetCatalogEntry[];
  outputs: ShaderOutputSnapshot[];
  surfaces: SurfaceReference[];
  surfaceAssignments: Record<string, string | null>;
  selectedOutputId: string | null;
  selectedSurfaceId: string | null;
  runtimeUniforms: UniformValueMap;
  audioUniforms: UniformValueMap;
  mappedAudioUniforms: UniformValueMap;
  audioVisualMapping: AudioVisualMappingState;
  feelingUniforms: UniformValueMap;
  effectiveFeelingUniforms: UniformValueMap;
  aiState: ShaderMasterAIState;
  visualState: VisualStateRuntimeSnapshot;
}
