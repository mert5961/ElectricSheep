import type { UniformValueMap } from '../contracts/types.ts';
import {
  AUDIO_VISUAL_SIGNAL_KEYS,
  type AudioVisualMappingState,
} from '../contracts/audioVisualMapping.ts';
import { cloneUniformMap } from '../contracts/uniforms.ts';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function resolveMappedAudioUniforms(
  audioUniforms: UniformValueMap,
  mapping: AudioVisualMappingState,
): UniformValueMap {
  const mappedUniforms = cloneUniformMap(audioUniforms);

  AUDIO_VISUAL_SIGNAL_KEYS.forEach((key) => {
    const tuning = mapping.signals[key];
    const rawValue = typeof audioUniforms[key] === 'number'
      ? audioUniforms[key] as number
      : 0;
    const isSoloFiltered = mapping.soloKey !== null && mapping.soloKey !== key;
    const isEnabled = tuning?.enabled !== false && !isSoloFiltered;

    if (!isEnabled || !tuning) {
      mappedUniforms[key] = 0;
      return;
    }

    const normalized = rawValue <= tuning.threshold
      ? 0
      : clamp01((rawValue - tuning.threshold) / Math.max(0.0001, 1 - tuning.threshold));
    const curved = Math.pow(normalized, tuning.curve);
    mappedUniforms[key] = clamp01(curved * tuning.gain);
  });

  return mappedUniforms;
}
