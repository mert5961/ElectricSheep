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
  floatField('u_tunnelDepth', 'Tunnel Depth', 'manual', 3.5, {
    min: 1,
    max: 8,
    step: 0.1,
    description: 'How deep the tunnel recedes.',
  }),
  intField('u_segments', 'Segments', 'manual', 8, {
    min: 3,
    max: 16,
    step: 1,
    description: 'Number of angular segments in the tunnel.',
  }),
]);

export const neonTunnelPreset: ShaderPresetDefinition = {
  id: 'neon-tunnel',
  label: 'Neon Tunnel',
  version: '1.0.0',
  tags: ['audio', 'kinetic', 'tunnel'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 1.0,
    u_intensity: 1.3,
    u_colorA: [0.0, 0.9, 1.0],
    u_colorB: [1.0, 0.0, 0.6],
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_tunnelDepth;
uniform int u_segments;
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
  float fragmentation = saturate(u_feelFragmentation);
  float glowFeel = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float densityFeel = saturate(u_feelDensity);

  float motionDrive = 0.12 + (1.0 - stillness) * 1.02 + densityFeel * 0.2;

  float radius = length(centered);
  float angle = atan(centered.y, centered.x);

  float depth = u_tunnelDepth / max(radius, 0.01);
  float zTravel = u_time * u_speed * motionDrive * (1.5 + bassSmooth * 2.0) + kick * 3.0;
  float tunnelZ = depth - zTravel;

  float segCount = float(max(u_segments, 3));
  float segAngle = floor(angle / (2.0 * PI) * segCount + 0.5) / segCount * 2.0 * PI;
  float segEdge = abs(angle - segAngle) * segCount;
  float segLine = exp(-segEdge * (10.0 + tension * 18.0 + densityFeel * 10.0)) * (0.36 + mid * 0.34 + glowFeel * 0.22);

  float ringPhase = fract(tunnelZ * (0.3 + flux * 0.2));
  float ringLine = exp(-abs(ringPhase - 0.5) * (16.0 + snare * 20.0 + fragmentation * 14.0));

  float kickPulse = exp(-radius * (4.0 - kick * 2.0)) * kick;
  float snareRipple = sin(depth * (6.0 + snare * 8.0) - u_time * 12.0) * snare * 0.5;
  snareRipple = saturate(snareRipple) * exp(-radius * 3.0);

  float hihatSparkle = noise(
    centered * (20.0 + treble * 30.0 + densityFeel * 16.0) + vec2(u_time * (8.0 + fragmentation * 3.5), -u_time * (6.0 + tension * 2.4))
  );
  hihatSparkle = pow(saturate(hihatSparkle - (0.68 - fragmentation * 0.12)), 2.5) * hihat;

  float vignette = 1.0 - smoothstep(0.3, 1.8, radius);
  float depthFade = exp(-max(depth - 1.0, 0.0) * 0.06);
  float fog = exp(-depth * (0.02 + rumble * 0.01));

  vec3 neonA = u_colorA * (1.0 + kick * 0.6);
  vec3 neonB = u_colorB * (1.0 + snare * 0.4);
  vec3 warmTint = mix(vec3(0.9, 0.96, 1.08), vec3(1.18, 0.92, 0.74), warmth * 0.78);

  vec3 rings = mix(neonA, neonB, ringPhase) * ringLine;
  vec3 segs = mix(neonB, neonA, 0.5 + 0.5 * sin(segAngle * 3.0)) * segLine;
  vec3 color = (rings + segs) * depthFade * fog;
  color += neonA * kickPulse * 1.2;
  color += neonB * snareRipple;
  color += vec3(1.0, 0.98, 0.95) * hihatSparkle * 0.5;
  color += mix(neonA, neonB, 0.5) * glowFeel * exp(-radius * (4.0 - densityFeel * 1.8)) * (0.24 + densityFeel * 0.14);
  color *= warmTint;
  color *= vignette;
  color *= 0.7 + u_intensity * 0.5 + rumble * 0.1 + fragmentation * 0.12 + tension * 0.08;

  gl_FragColor = vec4(color, 1.0);
}
`,
};
