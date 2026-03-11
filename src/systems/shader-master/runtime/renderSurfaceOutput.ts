import * as THREE from 'three';
import type {
  ShaderOutput,
  ShaderPresetDefinition,
  UniformValueMap,
} from '../contracts/types.ts';
import { resolveFinalUniforms } from './resolveFinalUniforms.ts';
import { applyShaderUniformValue } from './compileShader.ts';
import { ShaderCache } from './shaderCache.ts';

export interface RenderSurfaceOutputOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  shaderCache: ShaderCache;
  preset: ShaderPresetDefinition;
  output: ShaderOutput;
  target: THREE.WebGLRenderTarget;
  runtimeUniforms: UniformValueMap;
  audioUniforms: UniformValueMap;
  feelingUniforms: UniformValueMap;
}

export function renderSurfaceOutput({
  renderer,
  scene,
  camera,
  mesh,
  shaderCache,
  preset,
  output,
  target,
  runtimeUniforms,
  audioUniforms,
  feelingUniforms,
}: RenderSurfaceOutputOptions): UniformValueMap {
  const resolvedUniforms = resolveFinalUniforms({
    preset,
    output,
    runtimeUniforms,
    audioUniforms,
    feelingUniforms,
  });

  const material = shaderCache.getMaterial(preset);

  preset.uniformSchema.forEach((field) => {
    const value = resolvedUniforms[field.key] ?? field.defaultValue;
    const uniform = material.uniforms[field.key];
    if (uniform) {
      applyShaderUniformValue(field, uniform, value);
    }
  });

  mesh.material = material;
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  return resolvedUniforms;
}
