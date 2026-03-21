import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  floatField('u_bodyScale', 'Body Scale', 'manual', 1.0, {
    min: 0.55,
    max: 2.4,
    step: 0.01,
    description: 'Overall organism body size and breathing envelope.',
  }),
  floatField('u_structureDensity', 'Structure Density', 'manual', 1.1, {
    min: 0.6,
    max: 2.6,
    step: 0.01,
    description: 'Packing of internal ridges and body structure.',
  }),
  floatField('u_motionTurbulence', 'Motion Turbulence', 'manual', 0.8, {
    min: 0,
    max: 1.8,
    step: 0.01,
    description: 'Amount of internal agitation and fluid drift.',
  }),
]);

export const organismCorePreset: ShaderPresetDefinition = {
  id: 'organism-core',
  label: 'Organism Core',
  version: '0.1.0',
  tags: ['organism', 'candidate', 'unified'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 0.9,
    u_intensity: 1.1,
    u_colorA: [0.84, 0.95, 1.0],
    u_colorB: [0.06, 0.09, 0.14],
    u_feelGlow: 0.38,
    u_feelStillness: 0.22,
    u_feelDensity: 0.42,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_bodyScale;
uniform float u_structureDensity;
uniform float u_motionTurbulence;
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
  float pulse = saturate(u_audioPulse);

  float motionDrive = 0.1 + ((1.0 - stillness) * 1.2);
  float turbulence = u_motionTurbulence + ((1.0 - stillness) * 0.42) + (energy * 0.16) + (tension * 0.12);
  float densityDrive = u_structureDensity + (densityFeel * 1.8) + (bass * 0.28);

  vec2 drift = vec2(
    sin((u_time * u_speed * motionDrive * (0.55 + (mid * 1.8))) + (centered.y * (2.4 + (densityFeel * 2.0)))),
    cos((u_time * u_speed * motionDrive * (0.48 + (bass * 1.2))) - (centered.x * (2.8 + (densityFeel * 2.2))))
  ) * ((0.04 + (mid * 0.12) + (energy * 0.05)) * (0.55 + (turbulence * 0.55)));

  vec2 bodyUv = centered + drift;
  bodyUv = rotate2d((tension * 0.64) + (mid * 0.22) + (pulse * 0.14)) * bodyUv;

  float flow = fbm(
    (bodyUv * (1.4 + densityDrive))
    + vec2(
      u_time * motionDrive * (0.22 + (mid * 0.26)),
      -u_time * motionDrive * (0.18 + (pulse * 0.12))
    )
  );
  float veinNoise = fbm(
    (bodyUv * (3.4 + (densityDrive * 1.4) + (turbulence * 1.2)))
    + vec2(
      -u_time * motionDrive * (0.25 + (treble * 0.24)),
      u_time * motionDrive * (0.21 + (mid * 0.18))
    )
  );
  float tearNoise = noise(
    (bodyUv * (5.0 + (fragmentation * 11.0) + (densityFeel * 4.0)))
    + vec2(u_time * motionDrive * (0.5 + (fragmentation * 0.6)), 0.0)
  );

  float scaledRadius = length(bodyUv / max(0.15, u_bodyScale + (bass * 0.18) - (tension * 0.04)));
  float breathing = 0.5 + 0.5 * sin(
    (u_time * motionDrive * (1.3 + (bass * 1.6) + (pulse * 0.8)))
    - (scaledRadius * (7.0 + (densityFeel * 3.0)))
  );
  float membraneRadius = 0.36
    + (glowFeel * 0.1)
    + (bass * 0.08)
    + ((flow - 0.5) * 0.08)
    + (breathing * 0.03)
    - (tension * 0.03);
  float membraneWidth = max(0.035, 0.18 - (tension * 0.09) - (fragmentation * 0.06));
  float membrane = 1.0 - smoothstep(
    membraneRadius,
    membraneRadius + (membraneWidth / (0.9 + (densityDrive * 0.25))),
    scaledRadius + ((flow - 0.5) * 0.08 * turbulence)
  );
  float core = exp(-scaledRadius * (3.2 - (glowFeel * 1.1) - (bass * 0.65)));
  float cavity = exp(-scaledRadius * (7.5 + (tension * 1.6)));
  float vein = pow(saturate(0.58 - abs(veinNoise - 0.5)), 2.0) * (0.5 + (mid * 0.8) + (densityFeel * 0.35));
  float tearMask = mix(1.0, 0.35 + (0.65 * step(0.46 - (treble * 0.08), tearNoise)), fragmentation * 0.88);
  float pulseRing = exp(-abs(scaledRadius - (membraneRadius + 0.09 + (pulse * 0.04))) * (22.0 + (tension * 12.0))) * pulse;
  float trebleSpark = pow(saturate(
    noise(
      (bodyUv * (14.0 + (treble * 32.0) + (fragmentation * 10.0)))
      + vec2(
        u_time * motionDrive * (4.0 + (treble * 8.0)),
        -u_time * motionDrive * 3.0
      )
    ) - 0.62
  ), 4.0) * treble;

  membrane *= tearMask;

  vec3 coolBase = mix(u_colorB * vec3(0.86, 0.94, 1.08), u_colorA * vec3(0.58, 0.76, 0.98), saturate(flow + (densityFeel * 0.12)));
  vec3 warmBase = mix(
    u_colorB * vec3(1.18, 0.88, 0.68),
    u_colorA * vec3(1.18, 0.88, 0.68),
    saturate(flow + (glowFeel * 0.2))
  );
  vec3 bodyColor = mix(coolBase, warmBase, warmth * 0.95);
  vec3 innerLight = mix(
    u_colorA,
    vec3(1.0, 0.95, 0.88),
    saturate((glowFeel * 0.82) + (bass * 0.18) + (pulse * 0.16) + (warmth * 0.32))
  );
  vec3 fractureTint = mix(vec3(0.28, 0.42, 0.62), vec3(1.0, 0.76, 0.5), warmth);

  vec3 color = bodyColor * (0.12 + (membrane * (0.82 + (tension * 0.24))) + (core * (0.22 + (glowFeel * 0.2))));
  color += innerLight * core * (0.14 + (glowFeel * 0.42) + (energy * 0.14) + (pulse * 0.08));
  color += innerLight * pulseRing * (0.18 + (glowFeel * 0.18));
  color += mix(bodyColor, innerLight, 0.38) * vein * (0.12 + (mid * 0.18) + (densityFeel * 0.08));
  color += fractureTint * fragmentation * (1.0 - tearMask) * (0.16 + (tension * 0.14));
  color += vec3(1.0, 0.98, 0.94) * trebleSpark * (0.18 + (glowFeel * 0.1));
  color = mix(color, color * vec3(1.1, 0.92, 0.82), tension * 0.22);
  color *= 0.72 + (u_intensity * 0.34) + (energy * 0.12) + (cavity * 0.08) + (glowFeel * 0.08);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
