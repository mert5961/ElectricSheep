export interface AudioFeatureSummary {
  energyLevel: number;
  energyTrend: number;
  spectralBrightness: number;
  transientDensity: number;
  rhythmActivity: number;
  calmIndex: number;
  kickRate: number;
  snareRate: number;
  hatRate: number;
  dominantEvent: string;
}

export interface AIState {
  tension: number;
  glow: number;
  fragmentation: number;
  stillness: number;
  flowBias: number;
  warmth: number;
}

export interface ShaderMasterAIState {
  currentAIState: AIState;
  lastAIUpdateTime: number | null;
  aiEnabled: boolean;
  aiFallbackActive: boolean;
  aiStale: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function createDefaultAIState(): AIState {
  return {
    tension: 0.5,
    glow: 0.5,
    fragmentation: 0.5,
    stillness: 0.5,
    flowBias: 0.5,
    warmth: 0.5,
  };
}

export function cloneAIState(state: AIState): AIState {
  return {
    tension: clamp01(state.tension),
    glow: clamp01(state.glow),
    fragmentation: clamp01(state.fragmentation),
    stillness: clamp01(state.stillness),
    flowBias: clamp01(state.flowBias),
    warmth: clamp01(state.warmth),
  };
}

export function createDefaultShaderMasterAIState(): ShaderMasterAIState {
  return {
    currentAIState: createDefaultAIState(),
    lastAIUpdateTime: null,
    aiEnabled: true,
    aiFallbackActive: false,
    aiStale: false,
  };
}

export function cloneShaderMasterAIState(state: ShaderMasterAIState): ShaderMasterAIState {
  return {
    currentAIState: cloneAIState(state.currentAIState),
    lastAIUpdateTime: state.lastAIUpdateTime === null ? null : Math.max(0, state.lastAIUpdateTime),
    aiEnabled: Boolean(state.aiEnabled),
    aiFallbackActive: Boolean(state.aiFallbackActive),
    aiStale: Boolean(state.aiStale),
  };
}
