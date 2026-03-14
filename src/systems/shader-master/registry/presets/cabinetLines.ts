import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  floatField('u_lineDensity', 'Line Density', 'manual', 12, {
    min: 2,
    max: 32,
    step: 0.1,
    description: 'Density of the cabinet line stack.',
  }),
  floatField('u_scanWarp', 'Scan Warp', 'manual', 0.25, {
    min: 0,
    max: 1,
    step: 0.01,
    description: 'Curvature applied to the line field.',
  }),
]);

export const cabinetLinesPreset: ShaderPresetDefinition = {
  id: 'cabinet-lines',
  label: 'Cabinet Lines',
  version: '1.0.0',
  tags: ['architectural', 'graphic'],
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    u_speed: 0.55,
    u_intensity: 1.0,
    u_colorA: [0.86, 0.9, 0.98],
    u_colorB: [0.08, 0.12, 0.18],
    u_feelStillness: 0.55,
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
uniform float u_lineDensity;
uniform float u_scanWarp;
${SHARED_SHADER_UTILS}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= aspect;

  float tension = saturate(u_feelTension);
  float warmth = saturate(u_feelWarmth);
  float fragmentation = saturate(u_feelFragmentation);
  float glow = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);
  float densityFeel = saturate(u_feelDensity);

  float bass = saturate(u_audioBass);
  float mid = saturate(u_audioMid);
  float treble = saturate(u_audioTreble);
  float energy = saturate(u_audioEnergy);
  float pulse = saturate(u_audioPulse);

  float motionDrive = (0.35 + ((1.0 - stillness) * 0.9)) * (0.8 + (energy * 0.35));
  float timeFlow = u_time * u_speed * motionDrive;
  float midBreath = 0.5 + 0.5 * sin((centered.y * 2.2) + (timeFlow * (0.8 + (mid * 1.9))));
  float bassSway = sin((centered.x * 1.4) - (timeFlow * (1.2 + (bass * 1.8))));
  float trebleSpark = noise((centered * (18.0 + (treble * 34.0))) + vec2(timeFlow * 8.0, -timeFlow * 6.5));
  float warpAmount = ((u_scanWarp * 0.1) + (mid * 0.12) + (tension * 0.09) + (bass * 0.05))
    * (0.38 + ((1.0 - stillness) * 0.82));
  centered.x += sin((centered.y * 3.2) + (timeFlow * 0.35) + (midBreath * 1.4) + (bassSway * 0.9)) * warpAmount;
  centered.y += sin((centered.x * 2.6) - (timeFlow * 0.22) - (midBreath * 1.1)) * warpAmount * (0.3 + (tension * 0.38));
  centered += vec2(
    trebleSpark - 0.5,
    noise((centered.yx * 14.0) + vec2(-timeFlow * 7.0, timeFlow * 5.0)) - 0.5
  ) * tension * (0.015 + (fragmentation * 0.05));

  float density = u_lineDensity + (densityFeel * 10.0) + (mid * 7.0) + (midBreath * 1.8) + (tension * 4.0) + (bass * 4.5);
  float lineSharpness = mix(0.19, 0.08, saturate(tension + (fragmentation * 0.35)));
  float vertical = pow(1.0 - smoothstep(0.0, lineSharpness, abs(sin(centered.x * density * PI))), 2.0 + (tension * 1.2));
  float horizontal = pow(1.0 - smoothstep(0.0, 0.36 - (tension * 0.08), abs(sin((centered.y + 0.1) * density * 0.32 * PI))), 3.0);
  float scan = 0.5 + 0.5 * sin((centered.y * density * (0.7 + (mid * 0.18))) - (timeFlow * (3.0 + (mid * 1.1))) + (pulse * PI));
  float frame = 1.0 - smoothstep(0.64 - (tension * 0.05) - (bass * 0.03), 0.88 - (tension * 0.06), max(abs(centered.x), abs(centered.y) * 1.08));
  float shimmer = 1.0 + (pow(saturate(trebleSpark - 0.35), 3.0) * treble * 1.35);
  float fragmentCells = hash21(floor(vec2((centered.y * density * 0.22) + (timeFlow * 0.6), centered.x * 8.0 + (bass * 3.0))));
  float segmentBreak = mix(1.0, mix(0.62, 1.18, fragmentCells), fragmentation * 0.65);

  vec3 coolBase = mix(u_colorB * vec3(0.92, 0.98, 1.04), u_colorA * 0.18, frame);
  vec3 warmBase = mix(u_colorB * vec3(1.08, 0.9, 0.72), u_colorA * 0.28, frame);
  vec3 base = mix(coolBase, warmBase, warmth);
  vec3 lineColor = mix(
    mix(u_colorA, u_colorA * vec3(1.08, 0.92, 0.78), warmth),
    vec3(1.0),
    saturate((pulse * 0.28) + (glow * 0.34) + (treble * 0.52) + (tension * 0.24) + (energy * 0.18))
  );
  float lineMask = max(vertical * (0.84 + (tension * 0.38)), horizontal * (0.52 + (mid * 0.18))) * segmentBreak;

  vec3 color = base + (lineColor * lineMask * (0.42 + (scan * 0.36)) * shimmer);
  color *= 0.74 + (u_intensity * 0.32) + (tension * 0.12) + (energy * 0.08);
  color += frame * (0.04 + (bass * 0.05)) * mix(u_colorA, lineColor, 0.35 + (warmth * 0.25));
  color += lineColor * frame * tension * 0.08;
  color += vec3(1.0, 0.95, 0.86) * glow * pulse * 0.08;

  gl_FragColor = vec4(color, 1.0);
}
`,
};
