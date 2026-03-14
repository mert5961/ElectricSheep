import { cloneUniformMap } from './uniforms.ts';
import type { UniformValueMap } from './types.ts';

export type VisualStateRecipeId =
  | 'calm'
  | 'dense'
  | 'dreamy'
  | 'tense'
  | 'fragmented';

export type VisualStateTransitionMode = 'immediate' | 'lerp';
export type VisualStateTransitionEasing = 'linear' | 'easeInOut' | 'easeOut';

export interface VisualStateFeelingValues {
  tension: number;
  warmth: number;
  fragmentation: number;
  glow: number;
  stillness: number;
  density: number;
}

export interface VisualStateExpressiveValues {
  speed: number;
  intensity: number;
  patternDensity?: number;
  motionAmount?: number;
  scale?: number;
}

export interface VisualStateTransitionSettings {
  mode: VisualStateTransitionMode;
  durationMs: number;
  easing?: VisualStateTransitionEasing;
}

export interface NormalizedVisualStateTransitionSettings {
  mode: VisualStateTransitionMode;
  durationMs: number;
  easing: VisualStateTransitionEasing;
}

export interface VisualStateRecipe {
  id: VisualStateRecipeId | string;
  label: string;
  targetOutputId?: string;
  preset?: string;
  feeling: VisualStateFeelingValues;
  expressive: VisualStateExpressiveValues;
  transition: VisualStateTransitionSettings;
}

export interface ResolvedVisualState {
  recipeId: string;
  recipeLabel: string;
  outputId: string;
  presetId: string;
  feelingUniforms: UniformValueMap;
  expressiveUniforms: UniformValueMap;
}

export interface ResolvedVisualStateRecipe {
  state: ResolvedVisualState;
  transition: NormalizedVisualStateTransitionSettings;
  warnings: string[];
}

export interface VisualStateTransitionState {
  recipeId: string;
  recipeLabel: string;
  outputId: string;
  presetId: string;
  durationMs: number;
  easing: VisualStateTransitionEasing;
  elapsedMs: number;
  fromState: ResolvedVisualState;
}

export interface VisualStateRuntimeSnapshot {
  current: ResolvedVisualState | null;
  target: ResolvedVisualState | null;
  transition: VisualStateTransitionState | null;
}

export interface VisualStateRecipeResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function cloneResolvedVisualState(
  state: ResolvedVisualState | null,
): ResolvedVisualState | null {
  if (!state) {
    return null;
  }

  return {
    ...state,
    feelingUniforms: cloneUniformMap(state.feelingUniforms),
    expressiveUniforms: cloneUniformMap(state.expressiveUniforms),
  };
}

export function cloneVisualStateTransitionState(
  transition: VisualStateTransitionState | null,
): VisualStateTransitionState | null {
  if (!transition) {
    return null;
  }

  return {
    ...transition,
    fromState: cloneResolvedVisualState(transition.fromState) as ResolvedVisualState,
  };
}

export function cloneVisualStateRuntimeSnapshot(
  snapshot: VisualStateRuntimeSnapshot,
): VisualStateRuntimeSnapshot {
  return {
    current: cloneResolvedVisualState(snapshot.current),
    target: cloneResolvedVisualState(snapshot.target),
    transition: cloneVisualStateTransitionState(snapshot.transition),
  };
}

export function createEmptyVisualStateRuntimeSnapshot(): VisualStateRuntimeSnapshot {
  return {
    current: null,
    target: null,
    transition: null,
  };
}
