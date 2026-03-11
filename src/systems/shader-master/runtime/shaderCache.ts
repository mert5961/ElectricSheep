import * as THREE from 'three';
import type { ShaderPresetDefinition } from '../contracts/types.ts';
import { compileShader } from './compileShader.ts';

export class ShaderCache {
  private readonly materials = new Map<string, THREE.ShaderMaterial>();

  getMaterial(preset: ShaderPresetDefinition): THREE.ShaderMaterial {
    const existingMaterial = this.materials.get(preset.id);
    if (existingMaterial) {
      return existingMaterial;
    }

    const material = compileShader(preset);
    this.materials.set(preset.id, material);
    return material;
  }

  dispose(): void {
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
  }
}
