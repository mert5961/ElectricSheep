import * as THREE from 'three';
import type {
  ShaderPresetDefinition,
  ShaderUniformValue,
  UniformSchemaField,
} from '../contracts/types.ts';

const DEFAULT_FULLSCREEN_VERTEX_SHADER = `
varying vec2 v_uv;

void main() {
  v_uv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function toThreeUniformValue(
  field: UniformSchemaField,
  value: ShaderUniformValue,
): THREE.IUniform['value'] {
  if (field.type === 'vec2') {
    const [x, y] = value as [number, number];
    return new THREE.Vector2(x, y);
  }

  if (field.type === 'vec3') {
    const [x, y, z] = value as [number, number, number];
    return new THREE.Vector3(x, y, z);
  }

  if (field.type === 'vec4') {
    const [x, y, z, w] = value as [number, number, number, number];
    return new THREE.Vector4(x, y, z, w);
  }

  return value;
}

export function applyShaderUniformValue(
  field: UniformSchemaField,
  target: THREE.IUniform,
  value: ShaderUniformValue,
): void {
  if (field.type === 'vec2') {
    const [x, y] = value as [number, number];
    (target.value as THREE.Vector2).set(x, y);
    return;
  }

  if (field.type === 'vec3') {
    const [x, y, z] = value as [number, number, number];
    (target.value as THREE.Vector3).set(x, y, z);
    return;
  }

  if (field.type === 'vec4') {
    const [x, y, z, w] = value as [number, number, number, number];
    (target.value as THREE.Vector4).set(x, y, z, w);
    return;
  }

  target.value = value;
}

export function compileShader(
  preset: ShaderPresetDefinition,
): THREE.ShaderMaterial {
  const uniforms = preset.uniformSchema.reduce<Record<string, THREE.IUniform>>((accumulator, field) => {
    const value = preset.defaultUniforms[field.key] ?? field.defaultValue;
    accumulator[field.key] = {
      value: toThreeUniformValue(field, value),
    };
    return accumulator;
  }, {});

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: preset.vertexShader || DEFAULT_FULLSCREEN_VERTEX_SHADER,
    fragmentShader: preset.fragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
  });
}
