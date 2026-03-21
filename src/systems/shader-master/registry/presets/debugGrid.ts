import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  floatField('u_gridScale', 'Grid Scale', 'manual', 9, {
    min: 2,
    max: 24,
    step: 0.1,
    description: 'How many grid cells span the frame.',
  }),
  floatField('u_lineThickness', 'Line Thickness', 'manual', 0.08, {
    min: 0.01,
    max: 0.3,
    step: 0.01,
    description: 'Grid line thickness in UV space.',
  }),
]);

export const debugGridPreset: ShaderPresetDefinition = {
  id: 'debug-grid',
  label: 'Debug Grid',
  version: '1.0.0',
  tags: ['utility', 'calibration'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_intensity: 1.1,
    u_colorA: [0.1, 0.8, 1.0],
    u_colorB: [1.0, 0.52, 0.14],
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_gridScale;
uniform float u_lineThickness;
${SHARED_SHADER_UTILS}

void main() {
  vec2 uv = v_uv;
  float aspect = max(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
  vec2 centered = uv - 0.5;
  centered.x *= aspect;

  float tension = saturate(u_feelTension);
  float warmth = saturate(u_feelWarmth);
  float fragmentation = saturate(u_feelFragmentation);
  float glow = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float density = saturate(u_feelDensity);

  float bass = saturate(u_audioBass);
  float mid = saturate(u_audioMid);
  float treble = saturate(u_audioTreble);
  float energy = saturate(u_audioEnergy);
  float pulseSignal = saturate(u_audioPulse);

  float motionDrive = 0.14 + ((1.0 - stillness) * 1.18);
  float midBreath = sin((u_time * motionDrive * (0.8 + (mid * 2.2))) + (centered.y * 4.2));
  vec2 drift = vec2(
    sin((u_time * motionDrive * 1.1) + (centered.y * 5.4)),
    cos((u_time * motionDrive * 1.35) - (centered.x * 4.6))
  ) * mid * 0.15;
  centered += drift;

  float dynamicScale = max(1.5, u_gridScale + (midBreath * mid * 2.8) + (tension * 2.4) + (density * 5.6) + (bass * 1.3));
  vec2 gridUv = centered * dynamicScale;
  gridUv = mat2(1.0, tension * 0.2, -tension * 0.14, 1.0) * gridUv;
  vec2 cell = abs(fract(gridUv) - 0.5);
  float trebleSpark = hash21(floor(gridUv * (2.0 + (treble * 4.0))) + floor(u_time * motionDrive * (6.0 + (treble * 18.0))));
  float fragmentMask = hash21(floor((gridUv * (1.4 + (density * 1.8))) + vec2(u_time * motionDrive * 0.7, bass * 4.0)));
  float fragmentBreak = mix(1.0, mix(0.35, 1.22, fragmentMask), fragmentation * 0.82);
  float liveThickness = mix(u_lineThickness * (1.1 + (bass * 0.35)), max(0.008, u_lineThickness * (0.42 - (fragmentation * 0.12))), saturate((treble * 0.85) + (tension * 0.35)));
  float line = 1.0 - smoothstep(0.0, liveThickness, min(cell.x, cell.y));
  line = (line + (max(0.0, trebleSpark - 0.8) * treble * 0.75)) * fragmentBreak;

  float axisX = 1.0 - smoothstep(0.0, liveThickness * (1.4 + (tension * 0.45)), abs(centered.x));
  float axisY = 1.0 - smoothstep(0.0, liveThickness * (1.4 + (tension * 0.45)), abs(centered.y));
  float pulse = 0.5 + 0.5 * sin((u_time * motionDrive * (1.1 + (energy * 1.6)) * (1.0 + u_speed)) + (pulseSignal * PI) + (bass * 1.4));

  vec3 thermalShift = mix(vec3(0.88, 0.96, 1.08), vec3(1.16, 0.94, 0.72), warmth * 0.68);
  vec3 coolBackground = mix(u_colorA * vec3(0.08, 0.12, 0.2), u_colorB * vec3(0.18, 0.22, 0.32), uv.y + (midBreath * mid * 0.08));
  vec3 warmBackground = mix(u_colorA * vec3(0.28, 0.18, 0.08), u_colorB * vec3(0.42, 0.22, 0.08), uv.y + (bass * 0.12));
  vec3 background = mix(coolBackground, warmBackground, warmth * 0.92);
  vec3 gridColor = mix(u_colorA, mix(u_colorB, vec3(1.0, 0.84, 0.58), warmth * 0.72), saturate(uv.x + (treble * 0.28) + (trebleSpark * 0.12) + (density * 0.12)));
  gridColor = mix(gridColor, vec3(1.0, 0.98, 0.92), (treble * 0.22) + (tension * 0.26) + (glow * 0.24));
  gridColor *= 0.68 + (pulse * 0.22) + (glow * 0.34) + (energy * 0.12);

  float emphasis = max(line * (0.92 + (treble * 0.4) + (fragmentation * 0.18)), max(axisX, axisY) * (1.0 + (tension * 0.55) + (bass * 0.18)));
  vec3 color = mix(background, gridColor, saturate(emphasis * (u_intensity + (tension * 0.32) + (energy * 0.16))));
  color += (axisX + axisY) * (0.2 + (tension * 0.22) + (treble * 0.12) + (bass * 0.08)) * mix(u_colorB, vec3(1.0, 0.95, 0.86), 0.55 + (warmth * 0.28));
  color += gridColor * density * 0.14 * (1.0 - smoothstep(0.18, 0.48, length(centered)));
  color *= thermalShift;
  color *= 0.88 + (pulse * 0.14) + (tension * 0.1) + (energy * 0.06);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
