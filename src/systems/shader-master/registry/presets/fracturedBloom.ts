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

  float tension = saturate(u_feelTension + (u_audioEnergy * 0.42));
  float warmth = saturate(u_feelWarmth);
  float fragmentation = saturate(u_feelFragmentation + (u_audioTreble * 0.48) + (u_audioPulse * 0.12));
  float glowFeel = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float densityFeel = saturate(u_feelDensity);

  float bass = saturate(u_audioBass);
  float mid = saturate(u_audioMid);
  float treble = saturate(u_audioTreble);
  float energy = saturate(u_audioEnergy);
  float pulse = saturate(u_audioPulse);

  float motionDrive = 0.35 + ((1.0 - stillness) * 1.0);
  float radius = length(centered);
  float midPressure = 0.5 + 0.5 * sin((u_time * motionDrive * (0.8 + (mid * 2.0) + (energy * 0.7))) + (centered.y * 4.0));
  vec2 pressureOffset = vec2(
    sin((u_time * motionDrive * 0.7) + (centered.y * 5.0)),
    cos((u_time * motionDrive * 0.85) - (centered.x * 4.3))
  ) * mid * motionDrive * 0.18;
  vec2 warped = rotate2d(
    (u_time * u_speed * motionDrive * (0.18 + (tension * 0.16) + (pulse * 0.08)))
    + (fragmentation * 0.72)
    + ((midPressure - 0.5) * mid * 1.0)
  )
    * (centered + pressureOffset);
  vec2 cellUv = warped * (
    u_shardScale
    + (fragmentation * 4.8)
    + (densityFeel * 2.3)
    + (mid * 1.8)
    + (bass * 0.9)
    + (tension * 1.6)
  );
  vec2 cell = floor(cellUv);
  vec2 local = fract(cellUv) - 0.5;

  float nearest = 10.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 sampleCell = cell + offset;
      vec2 point = vec2(
        hash21(sampleCell + 0.17 + u_time * motionDrive * 0.05),
        hash21(sampleCell + 2.31 - u_time * motionDrive * 0.05)
      ) - 0.5;
      point *= 0.16
        + (fragmentation * 0.44)
        + (tension * 0.24)
        + (treble * 0.1)
        + (energy * 0.08)
        + ((1.0 - stillness) * 0.08);
      float distanceToPoint = length((offset + point) - local);
      nearest = min(nearest, distanceToPoint);
    }
  }

  float shards = 1.0 - smoothstep(0.08, 0.32 - (fragmentation * 0.12), nearest);
  float edgeSparkle = pow(saturate(1.0 - (nearest * (2.35 - (treble * 1.05) - (energy * 0.22)))), 6.0) * (treble + (pulse * 0.15));
  float bloom = exp(-radius * (3.3 - (glowFeel * 1.4) - (mid * 0.72) - (bass * 0.4))) * (
    u_bloom
    + (tension * 0.78)
    + (midPressure * mid * 0.38)
    + (bass * 0.16)
  );
  float noiseBand = fbm(
    warped * (3.0 + (treble * 2.4) + (densityFeel * 1.1))
    + vec2(
      u_time * u_speed * motionDrive * (0.3 + (mid * 0.28)),
      -u_time * motionDrive * (0.18 + (treble * 0.26) + (pulse * 0.12))
    )
  );
  float pulseShock = 0.5 + 0.5 * sin(
    (u_time * motionDrive * (1.5 + (pulse * 4.8) + (energy * 1.1)))
    - (radius * (8.0 + (densityFeel * 3.0)))
  );
  float fractureBand = pow(saturate(noiseBand - (0.56 - (fragmentation * 0.18))), 2.2);

  vec3 warmLift = mix(vec3(0.86, 0.92, 1.02), vec3(1.12, 0.94, 0.78), warmth);
  vec3 shardColor = mix(u_colorB, u_colorA, saturate(shards + (edgeSparkle * 0.5)));
  shardColor = mix(shardColor, shardColor * warmLift, warmth * 0.32);
  vec3 bloomColor = mix(
    u_colorA,
    vec3(1.0, 0.95, 0.82),
    saturate(glowFeel + (bass * 0.48) + (treble * 0.18) + (warmth * 0.2))
  );
  vec3 color = shardColor * (0.18 + (shards * (0.84 + (tension * 0.32))));
  color += bloomColor * bloom * (0.58 + (noiseBand * 0.42) + (mid * 0.22) + (pulseShock * pulse * 0.12));
  color += vec3(1.0, 0.96, 0.9) * edgeSparkle * (0.18 + (treble * 0.38));
  color += mix(u_colorA, u_colorB, noiseBand) * tension * 0.18;
  color += mix(u_colorB, warmLift, warmth * 0.6) * fractureBand * fragmentation * 0.14;
  color *= 0.68 + (u_intensity * 0.42) + (tension * 0.16) + (energy * 0.08);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
