import type {
  VisualStateRecipe,
  VisualStateRecipeId,
} from '../contracts/visualStateRecipe.ts';

const recipes: VisualStateRecipe[] = [
  {
    id: 'calm',
    label: 'Calm',
    preset: 'cabinet-lines',
    feeling: {
      tension: 0.08,
      warmth: 0.48,
      fragmentation: 0.08,
      glow: 0.34,
      stillness: 0.92,
      density: 0.18,
    },
    expressive: {
      speed: 0.32,
      intensity: 0.72,
      patternDensity: 0.2,
      motionAmount: 0.16,
    },
    transition: {
      mode: 'lerp',
      durationMs: 2600,
      easing: 'easeInOut',
    },
  },
  {
    id: 'dense',
    label: 'Dense',
    preset: 'cabinet-lines',
    feeling: {
      tension: 0.42,
      warmth: 0.22,
      fragmentation: 0.32,
      glow: 0.26,
      stillness: 0.14,
      density: 0.96,
    },
    expressive: {
      speed: 0.96,
      intensity: 1.48,
      patternDensity: 0.96,
      motionAmount: 0.54,
    },
    transition: {
      mode: 'lerp',
      durationMs: 1800,
      easing: 'easeInOut',
    },
  },
  {
    id: 'dreamy',
    label: 'Dreamy',
    preset: 'dream-gradient',
    feeling: {
      tension: 0.14,
      warmth: 0.78,
      fragmentation: 0.2,
      glow: 0.94,
      stillness: 0.64,
      density: 0.36,
    },
    expressive: {
      speed: 0.56,
      intensity: 1.18,
      motionAmount: 0.82,
      scale: 0.68,
    },
    transition: {
      mode: 'lerp',
      durationMs: 2400,
      easing: 'easeOut',
    },
  },
  {
    id: 'tense',
    label: 'Tense',
    preset: 'pulse',
    feeling: {
      tension: 0.94,
      warmth: 0.12,
      fragmentation: 0.34,
      glow: 0.24,
      stillness: 0.08,
      density: 0.7,
    },
    expressive: {
      speed: 1.96,
      intensity: 1.78,
      patternDensity: 0.76,
      motionAmount: 0.84,
    },
    transition: {
      mode: 'lerp',
      durationMs: 1200,
      easing: 'easeOut',
    },
  },
  {
    id: 'fragmented',
    label: 'Fragmented',
    preset: 'fractured-bloom',
    feeling: {
      tension: 0.6,
      warmth: 0.16,
      fragmentation: 0.98,
      glow: 0.42,
      stillness: 0.1,
      density: 0.74,
    },
    expressive: {
      speed: 1.34,
      intensity: 1.58,
      patternDensity: 0.88,
      scale: 0.62,
    },
    transition: {
      mode: 'lerp',
      durationMs: 1600,
      easing: 'easeInOut',
    },
  },
];

export const visualStateRecipeRegistry: Record<string, VisualStateRecipe> = recipes.reduce<
  Record<string, VisualStateRecipe>
>((accumulator, recipe) => {
  accumulator[recipe.id] = recipe;
  return accumulator;
}, {});

export function getVisualStateRecipe(
  recipeId: VisualStateRecipeId | string,
): VisualStateRecipe | null {
  return visualStateRecipeRegistry[recipeId] || null;
}

export function listVisualStateRecipes(): VisualStateRecipe[] {
  return recipes.map((recipe) => ({
    ...recipe,
    feeling: { ...recipe.feeling },
    expressive: { ...recipe.expressive },
    transition: { ...recipe.transition },
  }));
}
