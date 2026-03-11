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

  vec2 gridUv = centered * u_gridScale;
  vec2 cell = abs(fract(gridUv) - 0.5);
  float line = 1.0 - smoothstep(0.0, u_lineThickness, min(cell.x, cell.y));

  float axisX = 1.0 - smoothstep(0.0, u_lineThickness * 1.4, abs(centered.x));
  float axisY = 1.0 - smoothstep(0.0, u_lineThickness * 1.4, abs(centered.y));
  float pulse = 0.5 + 0.5 * sin(u_time * (1.0 + u_speed) * 2.4 + u_audioPulse * PI);

  vec3 background = mix(u_colorA * 0.12, u_colorB * 0.2, uv.y);
  vec3 gridColor = mix(u_colorA, u_colorB, saturate(uv.x + (u_audioTreble * 0.25)));
  gridColor *= 0.7 + (pulse * 0.25) + (u_feelGlow * 0.2);

  float emphasis = max(line, max(axisX, axisY));
  vec3 color = mix(background, gridColor, emphasis * u_intensity);
  color += (axisX + axisY) * 0.22 * mix(u_colorB, vec3(1.0), 0.5);

  gl_FragColor = vec4(color, 1.0);
}
`,
};
