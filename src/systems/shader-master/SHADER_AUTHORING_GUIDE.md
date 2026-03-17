# Shader Authoring Guide

How to create new shader presets for ElectricSheep's Shader Master system.

## File Structure

Each preset is a single TypeScript file in `src/systems/shader-master/registry/presets/`.

```typescript
import {
  createDefaultUniforms,
  createPresetUniformSchema,
  floatField,        // for float uniforms
  intField,          // for integer uniforms
  SHARED_FRAGMENT_UNIFORMS,
  SHARED_SHADER_UTILS,
} from '../../contracts/uniforms.ts';
import type { ShaderPresetDefinition } from '../../contracts/types.ts';

const uniformSchema = createPresetUniformSchema([
  // add any preset-specific uniforms here
]);

export const myPreset: ShaderPresetDefinition = {
  id: 'my-preset',           // unique kebab-case identifier
  label: 'My Preset',        // display name in UI
  version: '1.0.0',
  tags: ['audio', 'kinetic'], // for filtering in UI
  uniformSchema,
  defaultUniforms: createDefaultUniforms(uniformSchema, {
    // override any default values here
  }),
  fragmentShader: `
${SHARED_FRAGMENT_UNIFORMS}
// declare your custom uniforms here
${SHARED_SHADER_UTILS}

void main() {
  // your shader code
  gl_FragColor = vec4(color, 1.0);
}
`,
};
```

After creating the file, register it in `src/systems/shader-master/registry/presetRegistry.ts`:
1. Import the preset
2. Add it to the `presets` array

## Available Uniforms

### Runtime (auto-set, don't override)

| Uniform | Type | Description |
|---------|------|-------------|
| `u_time` | float | Seconds since render start |
| `u_resolution` | vec2 | Render target size in pixels |

### Audio Signals (0.0 - 1.0, noise-gated)

#### Continuous Levels
| Uniform | Type | Character | Use For |
|---------|------|-----------|---------|
| `u_audioBass` | float | Gated low-frequency level | Medium radial motion, bloom size |
| `u_audioMid` | float | Gated mid-frequency level | Rotation, density modulation, rhythm |
| `u_audioTreble` | float | Gated high-frequency level | Sparkle detail, edge highlights |
| `u_audioEnergy` | float | Overall waveform RMS | Background brightness, general reactivity |

#### Musical Onsets (event-driven, spike then decay)
| Uniform | Type | Character | Use For |
|---------|------|-----------|---------|
| `u_audioKick` | float | Sharp 0->1 spike on kick drum, 400ms decay | **Large punchy motion**: radial expansion, bloom flash, color burst, zoom |
| `u_audioSnare` | float | Sharp spike on snare hit, 300ms decay | **Medium sharp accent**: ring shockwave, brightness spike, glitch, pattern break |
| `u_audioHihat` | float | Fast spike on hihat/cymbal, 150ms decay | **Fine fast shimmer**: sparkle burst, edge highlight, noise grain, crackle |

#### Derived / Enriched
| Uniform | Type | Character | Use For |
|---------|------|-----------|---------|
| `u_audioBassSmooth` | float | Damped-spring bass (slow, overshoots) | Overall scale, breathing, gravitational motion |
| `u_audioHit` | float | Peak-hold envelope (any transient) | General bloom, combined hit reaction |
| `u_audioFlux` | float | Spectral flux (busy vs calm) | Detail density, noise intensity |
| `u_audioRumble` | float | Very slow energy (~3s tau) | Color temperature drift, tidal breathing |
| `u_audioPulse` | float | Legacy pulse detection | Backward compatibility |

### Feeling Signals (0.0 - 1.0, set by LLM or manual)

| Uniform | Type | Description |
|---------|------|-------------|
| `u_feelTension` | float | Dramatic intensity -- tighter patterns, harder edges |
| `u_feelWarmth` | float | Color temperature -- warmer tints, softer palette |
| `u_feelFragmentation` | float | Visual breakup -- Voronoi fracturing, block glitch |
| `u_feelGlow` | float | Luminance bloom -- center glow, halo softness |
| `u_feelStillness` | float | Motion suppression -- slower animation, calmer patterns |
| `u_feelDensity` | float | Pattern density -- more detail, tighter repetition |

### Manual Controls (user-tunable)

| Uniform | Type | Description |
|---------|------|-------------|
| `u_speed` | float | Global animation speed multiplier (0-4) |
| `u_intensity` | float | Overall brightness multiplier (0-3) |
| `u_colorA` | vec3 | Primary color (RGB, 0-1) |
| `u_colorB` | vec3 | Secondary color (RGB, 0-1) |

### Adding Custom Uniforms

Use the field helpers to add preset-specific controls:

```typescript
const uniformSchema = createPresetUniformSchema([
  floatField('u_myParam', 'My Param', 'manual', 0.5, {
    min: 0, max: 1, step: 0.01,
    description: 'What this parameter does.',
  }),
  intField('u_count', 'Count', 'manual', 8, {
    min: 1, max: 32, step: 1,
    description: 'Number of repetitions.',
  }),
]);
```

Declare matching uniforms in the GLSL string:
```glsl
uniform float u_myParam;
uniform int u_count;
```

## Shared GLSL Utilities

`SHARED_SHADER_UTILS` provides these functions:

| Function | Signature | Description |
|----------|-----------|-------------|
| `saturate` | `float saturate(float v)` | Clamp 0-1 |
| `rotate2d` | `mat2 rotate2d(float angle)` | 2D rotation matrix |
| `hash21` | `float hash21(vec2 p)` | Pseudo-random from 2D coords |
| `noise` | `float noise(vec2 p)` | Value noise |
| `fbm` | `float fbm(vec2 p)` | 4-octave fractal brownian motion |

Constant: `PI = 3.141592653589793`

Varying: `v_uv` -- normalized UV coordinates (0-1) from vertex shader.

## The Frequency-to-Visual-Scale Principle

Map audio signal speed to visual scale:

```
SLOW signals  -->  LARGE visual changes
FAST signals  -->  SMALL visual changes
```

| Signal | Speed | Visual Scale | Example |
|--------|-------|-------------|---------|
| `rumble` | Very slow (~3s) | Overall color temperature, vignette | `mix(cold, warm, rumble)` |
| `bassSmooth` | Slow (~1s) | Radial breathing, global scale | `radius / (1.0 + bassSmooth * 0.3)` |
| `kick` | Event (~400ms decay) | Radial bloom burst | `exp(-r * 5.0) * kick` |
| `mid` | Medium rhythm | Wave speed, rotation | `sin(x + t * mid)` |
| `snare` | Event (~300ms decay) | Ring shockwave | `exp(-abs(r - 0.4) * 20.0) * snare` |
| `flux` | Medium-fast | Detail density | `noise(uv * (8.0 + flux * 16.0))` |
| `hihat` | Event (~150ms decay) | Sparkle particles | `pow(noise - 0.6, 3.0) * hihat` |
| `treble` | Fast continuous | Edge shimmer | Noise field modulation |

## Common Patterns

### Kick-Driven Radial Bloom
```glsl
float kickBloom = exp(-radius * (4.0 - kick * 2.0)) * kick;
color += bloomColor * kickBloom * 1.2;
```

### Snare Ring Shockwave
```glsl
float snareRing = exp(-abs(radius - (0.35 + snare * 0.1)) * 20.0) * snare;
color += vec3(1.0, 0.96, 0.9) * snareRing * 0.8;
```

### Hihat Sparkle Field
```glsl
float spark = noise(centered * (20.0 + treble * 25.0) + vec2(t * 8.0, -t * 6.0));
spark = pow(saturate(spark - 0.6), 3.0) * hihat;
color += vec3(1.0, 0.98, 0.95) * spark * 0.5;
```

### Bass Breathing Scale
```glsl
float scale = 1.0 + bassSmooth * 0.25;
float scaledRadius = radius / scale;
```

### Rumble Color Temperature Shift
```glsl
vec3 tint = mix(vec3(0.92, 0.96, 1.04), vec3(1.06, 0.94, 0.88), rumble);
color *= tint;
```

### Motion Drive (respects stillness feeling)
```glsl
float motionDrive = 0.25 + (1.0 - stillness) * 0.85;
float t = u_time * u_speed * motionDrive;
```

### Vignette
```glsl
float vignette = 1.0 - smoothstep(0.6, 2.0, radius);
color *= vignette;
```

### Final Intensity
```glsl
color *= 0.7 + u_intensity * 0.5 + rumble * 0.08;
```

## Shader Boilerplate Template

```glsl
void main() {
  // 1. Setup coordinates
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= aspect;

  // 2. Read audio signals
  float kick = saturate(u_audioKick);
  float snare = saturate(u_audioSnare);
  float hihat = saturate(u_audioHihat);
  float bassSmooth = saturate(u_audioBassSmooth);
  float mid = saturate(u_audioMid);
  float treble = saturate(u_audioTreble);
  float flux = saturate(u_audioFlux);
  float rumble = saturate(u_audioRumble);

  // 3. Read feeling signals
  float tension = saturate(u_feelTension);
  float warmth = saturate(u_feelWarmth);
  float glowFeel = saturate(u_feelGlow);
  float stillness = saturate(u_feelStillness);

  // 4. Compute motion and geometry
  float motionDrive = 0.25 + (1.0 - stillness) * 0.85;
  float t = u_time * u_speed * motionDrive;
  float radius = length(centered);

  // 5. Build visual layers
  //    - Base layer: geometry + continuous audio (mid, bassSmooth, rumble)
  //    - Kick layer: big radial bloom
  //    - Snare layer: ring shockwave or brightness spike
  //    - Hihat layer: sparkle noise

  // 6. Compose and output
  vec3 color = vec3(0.0);
  // ... add layers ...
  color *= 0.7 + u_intensity * 0.5 + rumble * 0.08;
  gl_FragColor = vec4(color, 1.0);
}
```

## Tips

- Always `saturate()` audio uniforms at the top to avoid negative/overflow values.
- Use `exp(-x)` for natural falloff instead of `1.0 / x`.
- Onset signals (kick/snare/hihat) spike to 1.0 then decay -- multiply them into short-lived effects.
- Continuous signals (bass/mid/treble) are steady levels -- use them for persistent visual properties.
- The noise gate ensures silence when no music plays. Don't add ambient motion tied to audio -- it will be zero.
- Always end with intensity scaling and vignette for consistent brightness across presets.
