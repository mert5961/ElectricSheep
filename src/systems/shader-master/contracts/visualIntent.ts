import type { UniformValueMap } from './types.ts';

export interface VisualIntent {
  targetOutputId: string;
  preset?: string;
  uniforms?: Partial<UniformValueMap>;
}

export interface VisualIntentResult {
  ok: boolean;
  errors: string[];
}
