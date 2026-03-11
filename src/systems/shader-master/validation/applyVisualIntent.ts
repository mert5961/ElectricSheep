import type { VisualIntent, VisualIntentResult } from '../contracts/visualIntent.ts';
import type { ShaderMasterStoreState } from '../store/shaderMasterStore.ts';

export function applyVisualIntent(
  state: ShaderMasterStoreState,
  intent: VisualIntent,
): VisualIntentResult {
  return state.applyVisualIntent(intent);
}
