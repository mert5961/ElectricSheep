import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  floatField('u_swirl', 'Swirl', 'manual', 1.2, {
    min: 0,
    max: 4,
    step: 0.01,
    description: 'Rotational distortion around the frame center.',
  }),
  floatField('u_drift', 'Drift', 'manual', 0.75, {
    min: 0,
    max: 2,
    step: 0.01,
    description: 'How quickly the gradient field migrates.',
  }),
]);

export const dreamGradientPreset: ShaderPresetDefinition = {
  id: 'dream-gradient',
  label: 'Dream Gradient',
  version: '1.0.0',
  tags: ['ambient', 'soft'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_intensity: 1.15,
    u_colorA: [0.08, 0.28, 0.82],
    u_colorB: [0.98, 0.42, 0.32],
    u_feelWarmth: 0.45,
    u_feelGlow: 0.35,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_swirl;
uniform float u_drift;
${SHARED_SHADER_UTILS}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= aspect;

  float drift = u_time * u_speed * (0.25 + u_drift);
  vec2 warped = rotate2d((length(centered) * u_swirl) + (u_feelStillness * 0.4)) * centered;
  vec2 flowUv = warped * (1.4 + (u_feelDensity * 1.6));
  flowUv += vec2(drift * 0.45, -drift * 0.28);

  float mist = fbm(flowUv + vec2(0.0, drift * 0.3));
  float veil = 0.5 + 0.5 * sin((warped.y * 3.4) - (drift * 1.3) + (mist * 2.8));
  float warmth = saturate((u_feelWarmth * 0.8) + (u_audioMid * 0.4));
  float glow = saturate((u_feelGlow * 0.8) + (u_audioEnergy * 0.35));

  vec3 gradient = mix(u_colorA, u_colorB, saturate(0.5 + (warped.y * 0.45) + (mist * 0.35)));
  vec3 haze = mix(u_colorB, vec3(1.0, 0.92, 0.86), warmth * 0.55);
  vec3 color = mix(gradient, haze, veil * 0.35);
  color += glow * mist * 0.18 * mix(u_colorA, u_colorB, 0.5);
  color *= 0.85 + (u_intensity * 0.35);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
