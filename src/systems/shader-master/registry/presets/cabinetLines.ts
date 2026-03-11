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

  float warpAmount = (u_scanWarp * 0.18) + (u_audioMid * 0.04);
  centered.x += sin((centered.y * 3.2) + (u_time * u_speed * 0.35)) * warpAmount;
  centered.y += sin((centered.x * 2.6) - (u_time * u_speed * 0.22)) * warpAmount * 0.45;

  float density = u_lineDensity + (u_feelDensity * 10.0);
  float vertical = pow(1.0 - smoothstep(0.0, 0.16, abs(sin(centered.x * density * PI))), 2.0);
  float horizontal = pow(1.0 - smoothstep(0.0, 0.35, abs(sin((centered.y + 0.1) * density * 0.32 * PI))), 3.0);
  float scan = 0.5 + 0.5 * sin((centered.y * density * 0.7) - (u_time * u_speed * 3.0));
  float frame = 1.0 - smoothstep(0.62, 0.88, max(abs(centered.x), abs(centered.y) * 1.08));

  vec3 base = mix(u_colorB, u_colorA * 0.18, frame);
  vec3 lineColor = mix(u_colorA, vec3(1.0), saturate((u_audioPulse * 0.4) + (u_feelGlow * 0.35)));
  float lineMask = max(vertical * 0.9, horizontal * 0.55);

  vec3 color = base + (lineColor * lineMask * (0.45 + scan * 0.35));
  color *= 0.78 + (u_intensity * 0.32);
  color += frame * 0.05 * mix(u_colorA, u_colorB, 0.3);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
