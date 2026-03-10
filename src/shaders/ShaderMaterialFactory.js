import * as THREE from 'three';
import vertexShader from './debug.vert.glsl';
import fragmentShader from './debug.frag.glsl';
import { MAX_SUBTRACT_QUADS } from '../surfaces/SurfaceConstants.js';

const DEFAULT_COLOR = new THREE.Color(0.3, 0.6, 1.0);
const DEFAULT_FEATHER = 0.05;

export class ShaderMaterialFactory {
  static createDebugMaterial({
    color = DEFAULT_COLOR,
    feather = DEFAULT_FEATHER,
    contentTransform = null,
    subtractTransforms = [],
    subtractFeathers = [],
    subtractCount = 0,
  } = {}) {
    return new THREE.ShaderMaterial({
      defines: {
        MAX_SUBTRACT_QUADS,
      },
      uniforms: {
        u_time: { value: 0.0 },
        u_color: { value: color.clone() },
        u_feather: { value: feather },
        u_contentTransform: { value: contentTransform ? contentTransform.clone() : new THREE.Matrix3().identity() },
        u_subtractTransforms: {
          value: normalizeSubtractTransforms(subtractTransforms),
        },
        u_subtractFeathers: {
          value: normalizeSubtractFeathers(subtractFeathers),
        },
        u_subtractCount: { value: subtractCount },
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

function normalizeSubtractTransforms(transforms) {
  const normalized = [];

  for (let i = 0; i < MAX_SUBTRACT_QUADS; i++) {
    const transform = transforms[i];
    normalized.push(transform ? transform.clone() : new THREE.Matrix3().identity());
  }

  return normalized;
}

function normalizeSubtractFeathers(feathers) {
  const normalized = [];

  for (let i = 0; i < MAX_SUBTRACT_QUADS; i++) {
    normalized.push(Number.isFinite(feathers[i]) ? feathers[i] : 0);
  }

  return normalized;
}
