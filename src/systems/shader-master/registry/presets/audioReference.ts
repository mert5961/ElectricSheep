import {
  createDefaultUniforms,
  createPresetUniformSchema,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema();

export const audioReferencePreset: ShaderPresetDefinition = {
  id: 'audio-reference',
  label: 'Audio Reference',
  version: '1.0.0',
  tags: ['audio', 'debug', 'reference'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 0.9,
    u_intensity: 1.0,
    u_colorA: [0.18, 0.82, 1.0],
    u_colorB: [0.04, 0.08, 0.14],
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
${SHARED_SHADER_UTILS}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= aspect;

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
  float tension = saturate(u_feelTension);
  float warmth = saturate(u_feelWarmth);
  float fragmentation = saturate(u_feelFragmentation);
  float glowFeel = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float densityFeel = saturate(u_feelDensity);

  float motionDrive = 0.18 + ((1.0 - stillness) * 1.08) + (densityFeel * 0.06);

  float baseRadius = length(centered);

  float bassSmoothScale = 1.0 + (bassSmooth * 0.28);
  float scaledRadius = baseRadius / bassSmoothScale;
  float body = 1.0 - smoothstep(0.18, 0.52, scaledRadius);

  float midWave = sin(
    (centered.x * (3.2 + densityFeel * 2.2))
    + (u_time * u_speed * motionDrive * (0.9 + (mid * 1.8) + (tension * 0.68)))
  );
  float midRibbon = exp(-abs(centered.y + (midWave * 0.18 * (mid + densityFeel * 0.32))) * (10.0 - (mid * 4.0) + (tension * 4.0)));

  float kickBloom = exp(-baseRadius * (4.5 + tension * 3.0)) * kick * (0.78 + glowFeel * 0.55);
  float snareRing = exp(-abs(baseRadius - (0.35 + snare * 0.1 + fragmentation * 0.09)) * (22.0 + tension * 15.0)) * snare;
  float hihatSpark = noise(
    (centered * (16.0 + (treble * 28.0) + (flux * 10.0) + (densityFeel * 16.0)))
    + vec2(u_time * u_speed * motionDrive * (4.0 + (treble * 5.0) + (fragmentation * 2.2)), -u_time * (5.0 + tension * 2.4))
  );
  hihatSpark = pow(saturate(hihatSpark - (0.71 - fragmentation * 0.12)), 3.4) * hihat;

  float fluxShimmer = noise(centered * (8.0 + flux * 16.0 + densityFeel * 10.0) + vec2(u_time * motionDrive * (3.0 + tension * 1.8))) * flux * (0.22 + fragmentation * 0.42 + tension * 0.12);
  float rumbleVignette = 1.0 - (baseRadius * (0.26 + (1.0 - stillness) * 0.08) * (1.0 - rumble * 0.6));

  vec3 thermalShift = mix(vec3(0.92, 0.98, 1.06), vec3(1.14, 0.94, 0.76), warmth * 0.68);
  vec3 background = mix(
    u_colorB * mix(vec3(0.78, 0.84, 1.02), vec3(1.08, 0.9, 0.72), warmth * 0.78),
    u_colorA * (0.1 + glowFeel * 0.1 + warmth * 0.08),
    rumble * 0.35 + glowFeel * 0.18 + warmth * 0.08
  );
  vec3 bodyColor = mix(
    mix(u_colorB, u_colorA, saturate(0.46 + (centered.y * 0.42))),
    mix(u_colorB * vec3(1.06, 0.92, 0.78), u_colorA * vec3(1.12, 0.92, 0.78), saturate(0.5 + (centered.y * 0.4))),
    warmth * 0.82
  );
  vec3 ribbonColor = mix(u_colorA, vec3(1.0, 0.96, 0.88), 0.18 + (mid * 0.22) + glowFeel * 0.12 + warmth * 0.12);
  vec3 kickColor = vec3(1.0, 0.3, 0.15);
  vec3 snareColor = vec3(0.2, 0.85, 1.0);
  vec3 hihatColor = vec3(1.0, 0.98, 0.92);

  vec3 color = background * (0.56 + (energy * 0.24) + (glowFeel * 0.16));
  color += bodyColor * body * (0.38 + (energy * 0.34) + (densityFeel * 0.12));
  color += ribbonColor * midRibbon * (0.04 + (mid * 0.34) + (densityFeel * 0.1));
  color += kickColor * kickBloom;
  color += snareColor * snareRing * 0.8;
  color += hihatColor * hihatSpark * 0.5;
  color += mix(u_colorA, u_colorB, 0.5) * fluxShimmer;
  color += mix(u_colorA, vec3(1.0, 0.95, 0.88), 0.46 + warmth * 0.18) * glowFeel * exp(-baseRadius * (3.8 - densityFeel * 1.4)) * 0.2;
  color *= thermalShift;
  color *= rumbleVignette;
  color *= 0.82 + (u_intensity * 0.28) + (rumble * 0.12) + (tension * 0.14);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
