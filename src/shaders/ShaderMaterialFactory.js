import * as THREE from 'three';
import vertexShader from './debug.vert.glsl';
import fragmentShader from './debug.frag.glsl';

const DEFAULT_COLOR = new THREE.Color(0.3, 0.6, 1.0);
const DEFAULT_FEATHER = 0.05;

export class ShaderMaterialFactory {
  static createDebugMaterial({ color = DEFAULT_COLOR, feather = DEFAULT_FEATHER } = {}) {
    return new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_color: { value: color.clone() },
        u_feather: { value: feather },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
  }
}
