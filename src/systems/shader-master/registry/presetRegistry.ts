import type {
  PresetCatalogEntry,
  ShaderPresetDefinition,
} from '../contracts/types.ts';
import { cloneUniformMap } from '../contracts/uniforms.ts';
import { cabinetLinesPreset } from './presets/cabinetLines.ts';
import { debugGridPreset } from './presets/debugGrid.ts';
import { dreamGradientPreset } from './presets/dreamGradient.ts';
import { fracturedBloomPreset } from './presets/fracturedBloom.ts';
import { pulsePreset } from './presets/pulse.ts';

const presets = [
  debugGridPreset,
  dreamGradientPreset,
  pulsePreset,
  fracturedBloomPreset,
  cabinetLinesPreset,
] as const;

export const presetRegistry: Record<string, ShaderPresetDefinition> = presets.reduce<
  Record<string, ShaderPresetDefinition>
>((accumulator, preset) => {
  accumulator[preset.id] = preset;
  return accumulator;
}, {});

export function listPresetDefinitions(): ShaderPresetDefinition[] {
  return presets.map((preset) => ({
    ...preset,
    uniformSchema: preset.uniformSchema.map((field) => ({ ...field })),
    defaultUniforms: cloneUniformMap(preset.defaultUniforms),
  }));
}

export function getPresetDefinition(presetId: string): ShaderPresetDefinition | null {
  return presetRegistry[presetId] || null;
}

export function listPresetCatalog(): PresetCatalogEntry[] {
  return presets.map((preset) => ({
    id: preset.id,
    label: preset.label,
    version: preset.version,
    tags: preset.tags ? [...preset.tags] : undefined,
    uniformSchema: preset.uniformSchema.map((field) => ({ ...field })),
    defaultUniforms: cloneUniformMap(preset.defaultUniforms),
  }));
}
