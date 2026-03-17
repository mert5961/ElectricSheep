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

  float tension = saturate(u_feelTension);
  float warmthFeel = saturate(u_feelWarmth);
  float fragmentation = saturate(u_feelFragmentation);
  float glowFeel = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float densityFeel = saturate(u_feelDensity);

  float bass = saturate(u_audioBass);
  float mid = saturate(u_audioMid);
  float treble = saturate(u_audioTreble);
  float energy = saturate(u_audioEnergy);
  float bassSmooth = saturate(u_audioBassSmooth);
  float flux = saturate(u_audioFlux);
  float rumble = saturate(u_audioRumble);
  float kick = saturate(u_audioKick);
  float snare = saturate(u_audioSnare);
  float hihat = saturate(u_audioHihat);

  float motionDrive = 0.3 + ((1.0 - stillness) * 0.95);
  float midBreath = 0.5 + 0.5 * sin((u_time * motionDrive * (0.45 + (mid * 1.8))) + (centered.y * 3.4));
  vec2 driftOffset = vec2(
    sin((u_time * motionDrive * 0.9) + (centered.y * 4.0)),
    cos((u_time * motionDrive * 1.1) - (centered.x * 3.2))
  ) * mid * motionDrive * 0.16;
  float drift = u_time * u_speed * motionDrive * (0.25 + u_drift + (mid * 0.45) + (tension * 0.12));
  vec2 warped = rotate2d(
    (length(centered) * (u_swirl + (tension * 1.0)))
    + (stillness * 0.42)
    + ((midBreath - 0.5) * mid * 1.4)
    + (rumble * 0.3)
  ) * (centered + driftOffset);
  vec2 flowUv = warped * (1.4 + (densityFeel * 1.6) + (mid * 0.9) + (tension * 0.55) + (bassSmooth * 0.65));
  flowUv += vec2(drift * 0.45, -drift * 0.28);

  float mist = fbm(flowUv + vec2(0.0, drift * 0.3));
  float breakupField = fbm((flowUv * (1.8 + (fragmentation * 2.2) + (flux * 1.0))) - vec2(drift * (0.18 + (fragmentation * 0.45)), 0.0));
  float breakup = pow(saturate(breakupField - (0.62 - (fragmentation * 0.18))), 2.0);
  float veil = 0.5 + 0.5 * sin((warped.y * (3.0 + (mid * 1.2))) - (drift * 1.3) + (mist * 2.8) + (tension * 1.4) + (snare * 2.4));
  float hihatSpark = noise((warped * (10.0 + (treble * 22.0) + (flux * 6.0))) + vec2(u_time * motionDrive * (3.0 + (treble * 9.0)), -u_time * motionDrive * 4.0));
  float warmth = saturate((warmthFeel * 0.78) + (mid * 0.38) + (rumble * 0.22) - (tension * 0.18));
  float glow = saturate((glowFeel * 0.82) + (rumble * 0.25) + (kick * 0.3));
  float kickBloom = exp(-length(warped + (driftOffset * 0.8)) * (2.7 - (bassSmooth * 1.2))) * kick * 1.2;
  float snareBreak = exp(-length(warped) * 3.5) * snare * 0.5;

  vec3 tidalTint = mix(vec3(0.94, 0.98, 1.04), vec3(1.06, 0.94, 0.88), rumble);
  vec3 gradient = mix(u_colorA, u_colorB, saturate(0.5 + (warped.y * 0.45) + (mist * 0.35) + (driftOffset.x * 0.2) + (densityFeel * 0.08) + (rumble * 0.1)));
  vec3 haze = mix(u_colorB, vec3(1.0, 0.92, 0.86), warmth * 0.55);
  vec3 color = mix(gradient, haze, veil * (0.3 + (mid * 0.18)));
  color *= tidalTint;
  color += glow * mist * 0.18 * mix(u_colorA, u_colorB, 0.5);
  color += vec3(1.0, 0.96, 0.92) * pow(saturate(hihatSpark - 0.45), 3.0) * hihat * 0.6;
  color += mix(u_colorA, vec3(1.0, 0.9, 0.8), warmth * 0.35) * kickBloom;
  color += vec3(1.0, 0.98, 0.92) * snareBreak;
  color = mix(color, color * vec3(1.06, 0.92, 0.88), (tension * 0.18) + (pow(mist, 2.0) * tension * 0.12));
  color = mix(color, color * mix(vec3(0.94, 0.98, 1.04), vec3(1.04, 0.94, 0.88), breakupField), fragmentation * 0.18);
  color += breakup * fragmentation * mix(vec3(0.02, 0.03, 0.05), vec3(0.08, 0.06, 0.04), warmth);
  color *= 0.82 + (u_intensity * 0.35) + (tension * 0.12) + (rumble * 0.08);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
