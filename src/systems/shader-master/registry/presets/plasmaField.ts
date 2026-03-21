import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  floatField('u_blobScale', 'Blob Scale', 'manual', 2.8, {
    min: 1,
    max: 6,
    step: 0.1,
    description: 'Scale of the plasma blob field.',
  }),
  floatField('u_warp', 'Warp', 'manual', 0.8, {
    min: 0,
    max: 2,
    step: 0.01,
    description: 'Domain warp intensity.',
  }),
]);

export const plasmaFieldPreset: ShaderPresetDefinition = {
  id: 'plasma-field',
  label: 'Plasma Field',
  version: '1.0.0',
  tags: ['audio', 'organic', 'plasma'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 0.7,
    u_intensity: 1.2,
    u_colorA: [1.0, 0.35, 0.05],
    u_colorB: [0.05, 0.2, 0.95],
    u_feelWarmth: 0.3,
    u_feelGlow: 0.4,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_blobScale;
uniform float u_warp;
${SHARED_SHADER_UTILS}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= aspect;

  float kick = saturate(u_audioKick);
  float snare = saturate(u_audioSnare);
  float hihat = saturate(u_audioHihat);
  float bassSmooth = saturate(u_audioBassSmooth);
  float mid = saturate(u_audioMid);
  float treble = saturate(u_audioTreble);
  float flux = saturate(u_audioFlux);
  float rumble = saturate(u_audioRumble);

  float tension = saturate(u_feelTension);
  float warmth = saturate(u_feelWarmth);
  float glowFeel = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float densityFeel = saturate(u_feelDensity);
  float fragmentation = saturate(u_feelFragmentation);

  float motionDrive = 0.16 + (1.0 - stillness) * 1.0 + densityFeel * 0.08;
  float t = u_time * u_speed * motionDrive;

  vec2 warpOffset = vec2(
    fbm(centered * 1.5 + vec2(t * 0.3, 0.0)),
    fbm(centered * 1.5 + vec2(0.0, t * 0.25))
  ) * u_warp * (1.0 + kick * 0.8 + tension * 0.55 + fragmentation * 0.22);

  vec2 p = centered + warpOffset;
  float scale = u_blobScale + densityFeel * 2.1 + bassSmooth * 0.8;

  float plasma1 = sin(p.x * scale + t * 1.2 + sin(p.y * scale * 0.7 + t * 0.8) * 2.0);
  float plasma2 = sin(p.y * scale * 1.1 - t * 0.9 + cos(p.x * scale * 0.6 - t * 1.1) * 1.8);
  float plasma3 = sin(length(p) * scale * 1.5 - t * 1.5 + kick * 4.0);
  float combined = (plasma1 + plasma2 + plasma3) / 3.0;

  float blobField = combined * 0.5 + 0.5;
  float blobEdge = abs(combined);
  float edgeLine = exp(-blobEdge * (6.0 + tension * 10.0 + snare * 12.0 + fragmentation * 12.0));

  float kickExpand = exp(-length(p) * (3.5 - kick * 2.0)) * kick;
  float snareCrack = pow(saturate(1.0 - blobEdge * (2.0 + snare * 3.0)), 8.0) * snare;
  float hihatCrackle = noise(
    centered * (14.0 + treble * 25.0 + fragmentation * 14.0 + densityFeel * 8.0) + vec2(t * 6.0, -t * 5.0)
  );
  hihatCrackle = pow(saturate(hihatCrackle - (0.64 - fragmentation * 0.08)), 3.0) * hihat;

  float depth = fbm(p * (2.0 + flux * 1.5 + fragmentation * 1.6) + vec2(t * 0.2));
  float rumbleGlow = exp(-length(centered) * (2.0 - rumble * 0.8)) * rumble * 0.15;
  float fractureNoise = noise(
    p * (5.0 + fragmentation * 9.0 + densityFeel * 2.4)
    + vec2(t * (0.8 + fragmentation * 0.9), -t * 0.55)
  );
  float fractureMask = mix(1.0, 0.38 + (0.62 * step(0.46 - fragmentation * 0.12, fractureNoise)), fragmentation * 0.82);
  edgeLine *= fractureMask;

  vec3 warmTint = mix(vec3(0.9, 0.96, 1.08), vec3(1.18, 0.92, 0.74), warmth * 0.86);
  vec3 plasmaColor = mix(u_colorA, u_colorB, blobField);
  plasmaColor = mix(plasmaColor, plasmaColor * vec3(1.26, 0.88, 0.66), depth * warmth * 0.55);
  vec3 edgeColor = mix(mix(u_colorB, vec3(1.0), 0.3 + mid * 0.2), vec3(1.0, 0.9, 0.74), warmth * 0.32);
  vec3 crackColor = mix(vec3(1.0), u_colorA, 0.3) * (1.0 + snare * 0.5);

  vec3 color = plasmaColor * (0.25 + blobField * 0.35 + mid * 0.15);
  color += edgeColor * edgeLine * (0.4 + flux * 0.3);
  color += u_colorA * kickExpand * 1.5;
  color += crackColor * snareCrack * 0.7;
  color += vec3(1.0, 0.97, 0.92) * hihatCrackle * 0.45;
  color += mix(u_colorA, u_colorB, 0.5) * rumbleGlow;
  color += mix(u_colorA, vec3(1.0, 0.94, 0.82), 0.5 + warmth * 0.25) * glowFeel * 0.14;
  color += mix(u_colorA, u_colorB, fractureNoise) * fragmentation * (1.0 - fractureMask) * 0.22;
  color *= warmTint;
  color *= 0.75 + u_intensity * 0.45 + rumble * 0.08 + fragmentation * 0.08;

  gl_FragColor = vec4(color, 1.0);
}
`,
};
