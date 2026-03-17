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
  intField('u_gridLines', 'Grid Lines', 'manual', 12, {
    min: 4,
    max: 32,
    step: 1,
    description: 'Number of grid lines per axis.',
  }),
  floatField('u_lineWidth', 'Line Width', 'manual', 0.04, {
    min: 0.005,
    max: 0.12,
    step: 0.005,
    description: 'Thickness of grid lines.',
  }),
]);

export const waveformGridPreset: ShaderPresetDefinition = {
  id: 'waveform-grid',
  label: 'Waveform Grid',
  version: '1.0.0',
  tags: ['audio', 'grid', 'digital'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 0.6,
    u_intensity: 1.4,
    u_colorA: [0.0, 1.0, 0.65],
    u_colorB: [0.0, 0.3, 0.8],
    u_feelTension: 0.2,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform int u_gridLines;
uniform float u_lineWidth;
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
  float energy = saturate(u_audioEnergy);

  float tension = saturate(u_feelTension);
  float warmth = saturate(u_feelWarmth);
  float glowFeel = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float fragmentation = saturate(u_feelFragmentation);

  float motionDrive = 0.25 + (1.0 - stillness) * 0.85;
  float t = u_time * u_speed * motionDrive;
  float radius = length(centered);

  float kickShock = kick * (1.0 - smoothstep(0.0, 0.6 + kick * 0.3, abs(radius - kick * 0.8)));

  vec2 warped = centered;
  warped += vec2(
    sin(centered.y * 3.0 + t * 1.5) * mid * 0.08,
    cos(centered.x * 2.5 + t * 1.2) * mid * 0.06
  );
  warped += centered * kickShock * 0.15;

  float gridCount = float(max(u_gridLines, 4));
  vec2 gridUv = warped * gridCount;
  vec2 gridFract = fract(gridUv) - 0.5;

  float lineThickness = u_lineWidth * (1.0 + snare * 0.5 - tension * 0.3);
  float hLine = exp(-abs(gridFract.y) / max(lineThickness, 0.001));
  float vLine = exp(-abs(gridFract.x) / max(lineThickness, 0.001));
  float grid = max(hLine, vLine);

  float waveY = sin(warped.x * (5.0 + mid * 8.0) + t * 3.0) * bassSmooth * 0.12;
  waveY += sin(warped.x * (12.0 + treble * 15.0) + t * 6.0) * treble * 0.04;
  float waveHighlight = exp(-abs(centered.y - waveY) / (0.02 + energy * 0.03)) * (0.4 + energy * 0.5);

  float snareGlitch = 0.0;
  if (snare > 0.1) {
    vec2 blockUv = floor(warped * (4.0 + snare * 6.0));
    float blockHash = hash21(blockUv + floor(t * 4.0));
    snareGlitch = step(1.0 - snare * 0.4, blockHash) * snare;
  }

  float hihatNoise = noise(centered * (25.0 + treble * 30.0) + vec2(t * 10.0));
  hihatNoise = pow(saturate(hihatNoise - 0.65), 3.0) * hihat * grid;

  float scanLine = exp(-abs(centered.y - fract(t * 0.3) * 2.0 + 1.0) * 30.0) * 0.2;

  float vignette = 1.0 - smoothstep(0.8, 2.0, radius);
  float warmTintFactor = warmth * 0.3;

  vec3 gridColor = mix(u_colorA, u_colorB, saturate(0.5 + warped.y * 0.5 + rumble * 0.2));
  vec3 waveColor = mix(u_colorA, vec3(1.0), 0.4);
  vec3 glitchColor = mix(u_colorB, vec3(1.0, 0.2, 0.3), 0.5) * (1.0 + snare * 0.5);

  vec3 color = vec3(0.0);
  color += gridColor * grid * (0.15 + energy * 0.2 + bassSmooth * 0.1);
  color += waveColor * waveHighlight;
  color += vec3(1.0, 0.95, 0.9) * kickShock * 0.6;
  color += glitchColor * snareGlitch * 0.5;
  color += vec3(1.0, 0.98, 0.95) * hihatNoise * 0.4;
  color += gridColor * scanLine;
  color += u_colorA * glowFeel * exp(-radius * 3.0) * 0.1;
  color = mix(color, color * vec3(1.08, 0.96, 0.88), warmTintFactor);
  color *= vignette;
  color *= 0.7 + u_intensity * 0.5 + rumble * 0.08;

  gl_FragColor = vec4(color, 1.0);
}
`,
};
