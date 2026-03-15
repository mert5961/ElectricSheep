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
  float pulse = saturate(u_audioPulse);

  float baseRadius = length(centered);
  float bassScale = 1.0 + (bass * 0.22);
  float scaledRadius = baseRadius / bassScale;
  float body = 1.0 - smoothstep(0.18, 0.52, scaledRadius);

  float midWave = sin((centered.x * 3.4) + (u_time * u_speed * (0.9 + (mid * 1.8))));
  float midRibbon = exp(-abs(centered.y + (midWave * 0.16 * mid)) * (10.0 - (mid * 4.0)));

  float pulseRing = exp(-abs(baseRadius - (0.34 + (pulse * 0.05))) * 30.0) * pulse;
  float pulseFlash = exp(-baseRadius * 8.0) * pulse * 0.35;

  float trebleSpark = noise(
    (centered * (16.0 + (treble * 28.0)))
    + vec2(u_time * u_speed * (4.0 + (treble * 5.0)), -u_time * 5.0)
  );
  trebleSpark = pow(saturate(trebleSpark - 0.68), 4.0) * treble;

  vec3 background = mix(u_colorB * 0.9, u_colorA * 0.12, energy * 0.35);
  vec3 bodyColor = mix(u_colorB, u_colorA, saturate(0.55 + (centered.y * 0.45)));
  vec3 ribbonColor = mix(u_colorA, vec3(1.0), 0.18 + (mid * 0.22));

  vec3 color = background * (0.6 + (energy * 0.24));
  color += bodyColor * body * (0.38 + (energy * 0.34));
  color += ribbonColor * midRibbon * (0.04 + (mid * 0.34));
  color += vec3(1.0, 0.96, 0.88) * (pulseRing * 0.72 + pulseFlash);
  color += vec3(1.0, 0.98, 0.92) * trebleSpark * 0.36;
  color *= 0.82 + (u_intensity * 0.28) + (energy * 0.12);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
