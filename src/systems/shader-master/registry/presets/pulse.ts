import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  intField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  intField('u_ringCount', 'Ring Count', 'manual', 6, {
    min: 1,
    max: 12,
    step: 1,
    description: 'How many pulse bands repeat outward from the center.',
  }),
  floatField('u_softness', 'Softness', 'manual', 0.18, {
    min: 0.02,
    max: 0.45,
    step: 0.01,
    description: 'Softness of the ring envelope.',
  }),
]);

export const pulsePreset: ShaderPresetDefinition = {
  id: 'pulse',
  label: 'Pulse',
  version: '1.0.0',
  tags: ['audio', 'kinetic'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 1.2,
    u_intensity: 1.25,
    u_colorA: [0.94, 0.14, 0.46],
    u_colorB: [0.13, 0.66, 1.0],
    u_audioEnergy: 0.2,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform int u_ringCount;
uniform float u_softness;
${SHARED_SHADER_UTILS}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= aspect;

  float radius = length(centered);
  float energy = saturate(u_audioEnergy + (u_audioBass * 0.55));
  float pulse = saturate(u_audioPulse + (u_feelTension * 0.4));
  float wave = sin((radius * float(max(u_ringCount, 1)) * 18.0) - (u_time * u_speed * 6.0) - (pulse * PI * 2.0));
  float ring = smoothstep(1.0 - u_softness, 1.0, wave * 0.5 + 0.5);
  float core = 1.0 - smoothstep(0.0, 0.35 + (u_feelStillness * 0.15), radius);
  float falloff = exp(-radius * (2.8 - (energy * 1.2)));

  vec3 body = mix(u_colorA, u_colorB, saturate(radius + (u_audioTreble * 0.2)));
  vec3 glow = mix(u_colorB, vec3(1.0), pulse * 0.35);
  vec3 color = body * (ring * (0.55 + energy) + core * 0.65) * falloff;
  color += glow * core * (0.22 + pulse * 0.3);
  color *= 0.8 + (u_intensity * 0.45);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
