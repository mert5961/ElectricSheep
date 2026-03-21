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

  float tension = saturate(u_feelTension);
  float warmth = saturate(u_feelWarmth);
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

  float motionDrive = 0.08 + ((1.0 - stillness) * 1.28);
  float radius = length(centered);

  float weightDrive = saturate(bassSmooth + (rumble * 0.3));

  float midMotion = 0.5 + 0.5 * sin(u_time * motionDrive * (1.1 + (mid * 2.4) + (flux * 0.8)));
  radius += sin((centered.y * 4.2) + (u_time * motionDrive * (1.6 + (mid * 3.2)))) * mid * 0.08;
  radius += sin((radius * (12.0 + (densityFeel * 4.0))) - (u_time * motionDrive * (2.2 + (bassSmooth * 2.6)))) * bassSmooth * 0.04;
  float ringDensity = float(max(u_ringCount, 1)) + (densityFeel * 4.6) + (mid * 2.2) + (midMotion * 0.8) + (flux * 1.5);
  float wave = sin(
    (radius * ringDensity * (16.0 + (tension * 8.0) + (densityFeel * 3.0)))
    - (u_time * u_speed * motionDrive * (5.6 + (mid * 3.0) + (tension * 2.4)))
    - (kick * PI * 2.5)
  );
  float softness = mix(u_softness, max(0.02, u_softness * 0.32), saturate((tension * 0.82) + (treble * 0.38) + (fragmentation * 0.3)));
  float ring = smoothstep(1.0 - softness, 1.0, wave * 0.5 + 0.5);
  float core = 1.0 - smoothstep(0.0, 0.26 + (stillness * 0.2) + (mid * 0.08) + (bassSmooth * 0.14) + (kick * 0.12) + (glowFeel * 0.08), radius);
  float falloff = exp(-radius * (2.7 - (weightDrive * 1.3) - (mid * 0.45) - (glowFeel * 0.22)));

  float hihatAccent = noise(
    (centered * (18.0 + (treble * 40.0) + (fragmentation * 12.0) + (flux * 8.0)))
    + vec2(u_time * motionDrive * (7.0 + (treble * 14.0)), -u_time * motionDrive * 5.0)
  );
  float angle = atan(centered.y, centered.x);
  float fragmentField = noise(
    vec2(
      angle * (2.0 + (fragmentation * 7.5)),
      radius * (11.0 + (densityFeel * 4.0))
    ) + vec2(u_time * motionDrive * (0.5 + (fragmentation * 2.2)), 0.0)
  );
  float fragmentMask = mix(1.0, 0.3 + (0.7 * step(0.42, fragmentField)), fragmentation * 0.9);
  ring *= fragmentMask;

  float kickBloom = exp(-radius * 5.0) * kick * 0.7;
  float snareRing = exp(-abs(radius - (0.35 + snare * 0.1)) * 20.0) * snare * 0.8;
  float halo = exp(-radius * (3.4 - (glowFeel * 1.8) - (bassSmooth * 0.7))) * (0.22 + (glowFeel * 0.62) + (kick * 0.35));

  vec3 warmTint = mix(vec3(0.88, 0.98, 1.08), vec3(1.18, 0.92, 0.72), saturate((warmth * 0.9) + (rumble * 0.2)));
  vec3 body = mix(u_colorA, u_colorB, saturate(radius + (treble * 0.32) + (fragmentation * 0.08) + (rumble * 0.12)));
  body = mix(body, body * warmTint, warmth * 0.52);
  vec3 kickColor = mix(u_colorA, vec3(1.0), 0.3 + kick * 0.4);
  vec3 snareColor = mix(u_colorB, vec3(1.0, 0.96, 0.9), snare * 0.5);
  vec3 color = body * (ring * (0.55 + weightDrive + (tension * 0.28)) + core * (0.58 + (mid * 0.28))) * falloff;
  color += kickColor * kickBloom;
  color += snareColor * snareRing;
  color += mix(u_colorB, vec3(1.0), 0.3) * halo;
  color += mix(u_colorA, u_colorB, fragmentField) * fragmentation * (1.0 - fragmentMask) * 0.28;
  color += vec3(1.0, 0.96, 0.9) * pow(saturate(hihatAccent - 0.52), 4.0) * hihat * ring * 0.7;
  color *= 0.76 + (u_intensity * 0.45) + (tension * 0.18) + (rumble * 0.1) + (glowFeel * 0.06);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
