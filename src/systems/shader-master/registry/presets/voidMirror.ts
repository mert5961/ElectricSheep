import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  floatField('u_reflectStrength', 'Reflect Strength', 'manual', 0.6, {
    min: 0,
    max: 1,
    step: 0.01,
    description: 'Intensity of the reflection effect.',
  }),
  floatField('u_surfaceTilt', 'Surface Tilt', 'manual', 0.35, {
    min: 0,
    max: 1,
    step: 0.01,
    description: 'Tilt of the reflective surface.',
  }),
]);

export const voidMirrorPreset: ShaderPresetDefinition = {
  id: 'void-mirror',
  label: 'Void Mirror',
  version: '1.0.0',
  tags: ['audio', 'dark', 'reflection'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 0.45,
    u_intensity: 1.4,
    u_colorA: [0.6, 0.0, 1.0],
    u_colorB: [0.0, 0.85, 0.75],
    u_feelTension: 0.35,
    u_feelGlow: 0.3,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_reflectStrength;
uniform float u_surfaceTilt;
${SHARED_SHADER_UTILS}

float voronoi(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float nearest = 10.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 point = vec2(hash21(cell + offset + 0.3), hash21(cell + offset + 1.7));
      float d = length(offset + point - local);
      nearest = min(nearest, d);
    }
  }
  return nearest;
}

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
  float fragmentation = saturate(u_feelFragmentation);
  float densityFeel = saturate(u_feelDensity);

  float motionDrive = 0.25 + (1.0 - stillness) * 0.75;
  float t = u_time * u_speed * motionDrive;
  float radius = length(centered);

  vec2 mirrorUv = centered;
  float surface = centered.y + u_surfaceTilt * (0.1 + bassSmooth * 0.15);
  float aboveSurface = smoothstep(-0.02, 0.02, surface);
  vec2 reflected = vec2(centered.x, -centered.y + 2.0 * u_surfaceTilt * (0.1 + bassSmooth * 0.15));
  vec2 sampleUv = mix(reflected, centered, aboveSurface);

  float ripple = sin(length(sampleUv) * (12.0 + kick * 15.0) - t * 4.0 - kick * 5.0);
  ripple *= (1.0 - aboveSurface) * u_reflectStrength * 0.03;
  sampleUv += normalize(sampleUv + 0.001) * ripple;

  float vCell = voronoi(sampleUv * (3.5 + densityFeel * 2.0 + tension * 1.5) + vec2(t * 0.3));
  float vEdge = 1.0 - smoothstep(0.0, 0.12 - fragmentation * 0.05, vCell);

  float depthFog = fbm(sampleUv * (2.0 + flux * 1.0) + vec2(t * 0.2, -t * 0.15));
  float voidDepth = exp(-radius * (1.8 - rumble * 0.5));

  float kickDepth = exp(-radius * (3.0 - kick * 1.5)) * kick * 1.2;
  float snareBreak = vEdge * snare * 0.8;
  float surfaceLine = exp(-abs(surface) * (40.0 + mid * 20.0)) * (0.3 + mid * 0.4 + snare * 0.3);

  float hihatFire = noise(centered * (20.0 + treble * 25.0) + vec2(t * 9.0, -t * 7.0));
  hihatFire = pow(saturate(hihatFire - 0.6), 3.0) * hihat * (0.5 + vEdge * 0.5);

  float reflectDim = mix(1.0, 0.55 + rumble * 0.15, (1.0 - aboveSurface) * u_reflectStrength);

  vec3 warmTint = mix(vec3(1.0), vec3(1.08, 0.94, 0.88), warmth * 0.4);
  vec3 voidColor = mix(u_colorB * 0.15, u_colorA * 0.3, depthFog);
  vec3 edgeColor = mix(u_colorA, u_colorB, vCell);
  vec3 surfaceColor = mix(u_colorA, vec3(1.0), 0.5);

  vec3 color = voidColor * voidDepth * (0.6 + mid * 0.2);
  color += edgeColor * vEdge * (0.3 + tension * 0.3 + flux * 0.15);
  color += u_colorA * kickDepth;
  color += mix(u_colorB, vec3(1.0), 0.3) * snareBreak;
  color += surfaceColor * surfaceLine;
  color += vec3(1.0, 0.85, 0.6) * hihatFire * 0.5;
  color += mix(u_colorA, u_colorB, 0.5) * glowFeel * exp(-radius * 3.0) * 0.08;
  color *= reflectDim;
  color *= warmTint;
  color *= 0.7 + u_intensity * 0.5 + rumble * 0.08;

  gl_FragColor = vec4(color, 1.0);
}
`,
};
