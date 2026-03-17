import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  floatField('u_aberration', 'Aberration', 'manual', 0.025, {
    min: 0,
    max: 0.1,
    step: 0.001,
    description: 'Base chromatic aberration offset.',
  }),
  floatField('u_bloomSize', 'Bloom Size', 'manual', 0.35, {
    min: 0.1,
    max: 0.8,
    step: 0.01,
    description: 'Size of the center bloom.',
  }),
]);

export const chromaticBloomPreset: ShaderPresetDefinition = {
  id: 'chromatic-bloom',
  label: 'Chromatic Bloom',
  version: '1.0.0',
  tags: ['audio', 'bloom', 'chromatic'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 0.5,
    u_intensity: 1.35,
    u_colorA: [1.0, 0.15, 0.4],
    u_colorB: [0.1, 0.4, 1.0],
    u_feelGlow: 0.5,
    u_feelWarmth: 0.2,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_aberration;
uniform float u_bloomSize;
${SHARED_SHADER_UTILS}

float bloomShape(vec2 p, float size) {
  float r = length(p);
  float glow = exp(-r * r / max(size * size, 0.001));
  return glow;
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
  float energy = saturate(u_audioEnergy);

  float tension = saturate(u_feelTension);
  float warmth = saturate(u_feelWarmth);
  float glowFeel = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float fragmentation = saturate(u_feelFragmentation);

  float motionDrive = 0.3 + (1.0 - stillness) * 0.7;
  float t = u_time * u_speed * motionDrive;
  float radius = length(centered);
  float angle = atan(centered.y, centered.x);

  float abAmount = u_aberration * (1.0 + snare * 3.0 + tension * 1.5);
  vec2 abDir = normalize(centered + 0.001);

  float bloomR = bloomShape(centered + abDir * abAmount, u_bloomSize * (1.0 + kick * 0.4 + bassSmooth * 0.2));
  float bloomG = bloomShape(centered, u_bloomSize * (1.0 + kick * 0.35 + bassSmooth * 0.15));
  float bloomB = bloomShape(centered - abDir * abAmount, u_bloomSize * (1.0 + kick * 0.3 + bassSmooth * 0.1));

  float kickBurst = exp(-radius * (3.0 - kick * 1.5)) * kick;

  float snareAb = snare * 0.6;
  float snareWave = sin(radius * (15.0 + snare * 10.0) - t * 8.0 - snare * 6.0);
  snareWave = saturate(snareWave) * exp(-radius * 4.0) * snare;

  float hihatGrain = noise(centered * (18.0 + treble * 28.0) + vec2(t * 7.0, -t * 5.5));
  hihatGrain = pow(saturate(hihatGrain - 0.58), 3.0) * hihat;

  float orbit1 = bloomShape(
    centered - vec2(cos(t * 1.2 + mid), sin(t * 0.9 + mid)) * (0.3 + mid * 0.2),
    0.15 + mid * 0.08
  ) * mid * 0.4;
  float orbit2 = bloomShape(
    centered - vec2(cos(t * 0.8 - 1.5), sin(t * 1.1 + 0.5)) * (0.4 + flux * 0.15),
    0.12 + flux * 0.06
  ) * flux * 0.3;

  float vignette = 1.0 - smoothstep(0.6, 2.2, radius);

  vec3 warmTint = mix(vec3(1.0), vec3(1.1, 0.95, 0.85), warmth * 0.4 + rumble * 0.15);
  float redCh = bloomR * u_colorA.r + bloomG * u_colorA.g * 0.3 + bloomB * u_colorB.r * 0.2;
  float greenCh = bloomR * u_colorA.g * 0.3 + bloomG * mix(u_colorA.g, u_colorB.g, 0.5) + bloomB * u_colorB.g * 0.3;
  float blueCh = bloomR * u_colorB.b * 0.2 + bloomG * u_colorB.b * 0.3 + bloomB * u_colorB.b;

  vec3 color = vec3(redCh, greenCh, blueCh) * (0.5 + glowFeel * 0.4);
  color += u_colorA * kickBurst * 1.3;
  color += vec3(1.0, 0.97, 0.93) * snareWave * 0.6;
  color += vec3(1.0, 0.98, 0.95) * hihatGrain * 0.4;
  color += u_colorA * orbit1;
  color += u_colorB * orbit2;
  color += vec3(snareAb * 0.15, 0.0, snareAb * 0.1);
  color *= warmTint;
  color *= vignette;
  color *= 0.65 + u_intensity * 0.5 + rumble * 0.1;

  gl_FragColor = vec4(color, 1.0);
}
`,
};
