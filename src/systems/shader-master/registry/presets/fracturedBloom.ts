import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  floatField('u_shardScale', 'Shard Scale', 'manual', 4.5, {
    min: 1,
    max: 10,
    step: 0.1,
    description: 'Density of fractured cell shapes.',
  }),
  floatField('u_bloom', 'Bloom', 'manual', 0.65, {
    min: 0,
    max: 1.5,
    step: 0.01,
    description: 'Brightness of the center bloom.',
  }),
]);

export const fracturedBloomPreset: ShaderPresetDefinition = {
  id: 'fractured-bloom',
  label: 'Fractured Bloom',
  version: '1.0.0',
  tags: ['dramatic', 'feeling'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 0.8,
    u_intensity: 1.35,
    u_colorA: [1.0, 0.76, 0.18],
    u_colorB: [0.12, 0.02, 0.28],
    u_feelTension: 0.4,
    u_feelFragmentation: 0.55,
    u_feelGlow: 0.4,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_shardScale;
uniform float u_bloom;
${SHARED_SHADER_UTILS}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= aspect;

  float fragmentation = saturate(u_feelFragmentation + (u_audioTreble * 0.35));
  float tension = saturate(u_feelTension + (u_audioEnergy * 0.25));
  vec2 warped = rotate2d((u_time * u_speed * 0.18) + (fragmentation * 0.4)) * centered;
  vec2 cellUv = warped * (u_shardScale + (fragmentation * 4.0));
  vec2 cell = floor(cellUv);
  vec2 local = fract(cellUv) - 0.5;

  float nearest = 10.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 sampleCell = cell + offset;
      vec2 point = vec2(
        hash21(sampleCell + 0.17 + u_time * 0.05),
        hash21(sampleCell + 2.31 - u_time * 0.05)
      ) - 0.5;
      point *= 0.28 + (fragmentation * 0.4);
      float distanceToPoint = length((offset + point) - local);
      nearest = min(nearest, distanceToPoint);
    }
  }

  float shards = 1.0 - smoothstep(0.08, 0.32 - (fragmentation * 0.12), nearest);
  float radius = length(centered);
  float bloom = exp(-radius * (3.2 - (u_feelGlow * 1.1))) * (u_bloom + tension * 0.55);
  float noiseBand = fbm(warped * 3.2 + vec2(u_time * u_speed * 0.3, -u_time * 0.18));

  vec3 shardColor = mix(u_colorB, u_colorA, shards);
  vec3 bloomColor = mix(u_colorA, vec3(1.0, 0.95, 0.82), saturate(u_feelGlow + u_audioBass * 0.4));
  vec3 color = shardColor * (0.2 + shards * 0.85);
  color += bloomColor * bloom * (0.6 + noiseBand * 0.35);
  color += mix(u_colorA, u_colorB, noiseBand) * tension * 0.08;
  color *= 0.72 + (u_intensity * 0.45);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
