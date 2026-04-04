import type { AIState, AudioFeatureSummary } from '../contracts/aiState.ts';
import { cloneAIState, createDefaultAIState } from '../contracts/aiState.ts';

interface OllamaGenerateResponse {
  response?: string;
}

type AIRuntimeMode = 'auto' | 'local' | 'remote';

export interface AIRequestMeta {
  fallbackActive: boolean;
  receivedAtMs: number | null;
  reason: string | null;
  backoffUntilMs: number | null;
}

export interface AIRequestContext {
  previousAIState?: AIState | null;
  updateReason?: string | null;
}

const OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'qwen2.5:7b-instruct';
const REMOTE_ENDPOINT = (import.meta.env.VITE_AI_BACKEND_URL || '').trim();
const AI_RUNTIME_MODE = normalizeRuntimeMode(import.meta.env.VITE_AI_MODE);

const REQUIRED_AI_STATE_KEYS = [
  'tension',
  'glow',
  'fragmentation',
  'stillness',
  'flowBias',
  'warmth',
] as const;

const STRICT_PROMPT_TEMPLATE = `You are a slow, high-level feeling interpreter for a real-time audio-reactive visual system.

The real-time analyzer already handles beat-level motion, impacts, rhythm, and direct visual reactivity.
Your job is only to update the slower macro feeling layer.

Treat the input as phrase-level and section-level musical context, not as a single instant audio frame.
The summary may include phraseState, sectionState, activityConfidence, changeStrength, updateReason, and previousAIState.

Prefer continuity.
If updateReason indicates a refresh instead of a real change, stay very close to previousAIState.
If activityConfidence is low or changeStrength is low, keep the feeling stable.
Section changes matter more than local short-term spikes.
When updateReason is section-change or boot, it is acceptable to move the state clearly enough to matter visually.
Avoid tiny 0.01-style changes unless the music is genuinely unchanged.

Use sectionState as a strong guide:
- groove: balanced and stable, moderate values near the middle
- build: higher tension, glow, fragmentation, and flowBias; lower stillness
- drop: strong tension, glow, and flowBias; low stillness; moderate fragmentation
- breakdown: higher stillness and warmth; lower tension and flowBias; lower fragmentation
- transition: meaningfully different from the previous state, but not extreme

Use phraseState as a secondary guide:
- lifting: slightly more tension, glow, and flowBias
- settling: slightly more stillness and warmth
- thinning: slightly less fragmentation and glow
- suspended: noticeably more stillness, less tension

Fragmentation should respond most to:
- high transientDensity
- high spectralBrightness
- active hatRate / treble-led activity
- unstable or changing musical state

If the track feels smooth, sparse, low-brightness, or breakdown-like, fragmentation should stay clearly lower.

When the section meaningfully changed, prefer clearly separated values such as 0.30, 0.65, or 0.78 over barely-different values like 0.49 and 0.52.
The output should remain stable, but it should still be visually legible.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.
Do not include any text outside JSON.

You must return exactly these keys:
tension, glow, fragmentation, stillness, flowBias, warmth

All values must be floats between 0.0 and 1.0.

Interpret the musical direction conservatively.
Favor phrase continuity over short-term novelty.
Do not make large swings unless the section meaningfully changed.
Do not output anything except JSON.

INPUT:
{{FEATURE_SUMMARY_JSON}}`;

let lastValidState: AIState = {
  ...createDefaultAIState(),
};

let lastAIRequestMeta: AIRequestMeta = {
  fallbackActive: false,
  receivedAtMs: null,
  reason: null,
  backoffUntilMs: null,
};

function normalizeRuntimeMode(value: string | undefined): AIRuntimeMode {
  if (value === 'local' || value === 'remote') {
    return value;
  }

  return 'auto';
}

function resolveAIRuntimeTarget(): { endpoint: string; mode: 'local' | 'remote' } {
  if (AI_RUNTIME_MODE === 'local') {
    return {
      endpoint: OLLAMA_ENDPOINT,
      mode: 'local',
    };
  }

  if (REMOTE_ENDPOINT) {
    return {
      endpoint: REMOTE_ENDPOINT,
      mode: 'remote',
    };
  }

  return {
    endpoint: OLLAMA_ENDPOINT,
    mode: 'local',
  };
}

function parseRetryAfterMs(response: Response): number | null {
  const retryAfterHeader = response.headers.get('Retry-After');

  if (!retryAfterHeader) {
    return null;
  }

  const numericSeconds = Number(retryAfterHeader);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return Math.round(numericSeconds * 1000);
  }

  const retryAtMs = Date.parse(retryAfterHeader);
  if (Number.isFinite(retryAtMs)) {
    return Math.max(0, retryAtMs - Date.now());
  }

  return null;
}

function clampValue(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function clampExpressiveRange(value: number): number {
  return clampValue(value, 0.06, 0.94);
}

function applyCenteredContrast(value: number, amount: number): number {
  return clampValue(0.5 + ((value - 0.5) * amount));
}

function blendScalar(fromValue: number, toValue: number, amount: number): number {
  return clampValue(fromValue + ((toValue - fromValue) * amount));
}

function blendAIState(fromState: AIState, toState: AIState, amount: number): AIState {
  return {
    tension: blendScalar(fromState.tension, toState.tension, amount),
    glow: blendScalar(fromState.glow, toState.glow, amount),
    fragmentation: blendScalar(fromState.fragmentation, toState.fragmentation, amount),
    stillness: blendScalar(fromState.stillness, toState.stillness, amount),
    flowBias: blendScalar(fromState.flowBias, toState.flowBias, amount),
    warmth: blendScalar(fromState.warmth, toState.warmth, amount),
  };
}

function getSectionAnchor(sectionState: AudioFeatureSummary['sectionState']): AIState {
  switch (sectionState) {
    case 'build':
      return {
        tension: 0.78,
        glow: 0.68,
        fragmentation: 0.64,
        stillness: 0.26,
        flowBias: 0.76,
        warmth: 0.42,
      };
    case 'drop':
      return {
        tension: 0.82,
        glow: 0.74,
        fragmentation: 0.58,
        stillness: 0.18,
        flowBias: 0.84,
        warmth: 0.48,
      };
    case 'breakdown':
      return {
        tension: 0.28,
        glow: 0.34,
        fragmentation: 0.28,
        stillness: 0.8,
        flowBias: 0.22,
        warmth: 0.64,
      };
    case 'transition':
      return {
        tension: 0.62,
        glow: 0.58,
        fragmentation: 0.48,
        stillness: 0.38,
        flowBias: 0.6,
        warmth: 0.5,
      };
    case 'groove':
    default:
      return {
        tension: 0.56,
        glow: 0.54,
        fragmentation: 0.44,
        stillness: 0.42,
        flowBias: 0.58,
        warmth: 0.54,
      };
  }
}

function applyPhraseAdjustment(
  state: AIState,
  phraseState: AudioFeatureSummary['phraseState'],
  amount: number,
): AIState {
  const nextState = { ...state };

  switch (phraseState) {
    case 'lifting':
      nextState.tension = clampValue(nextState.tension + (0.16 * amount));
      nextState.glow = clampValue(nextState.glow + (0.12 * amount));
      nextState.fragmentation = clampValue(nextState.fragmentation + (0.06 * amount));
      nextState.flowBias = clampValue(nextState.flowBias + (0.14 * amount));
      nextState.stillness = clampValue(nextState.stillness - (0.16 * amount));
      break;
    case 'settling':
      nextState.stillness = clampValue(nextState.stillness + (0.14 * amount));
      nextState.warmth = clampValue(nextState.warmth + (0.1 * amount));
      nextState.tension = clampValue(nextState.tension - (0.12 * amount));
      nextState.fragmentation = clampValue(nextState.fragmentation - (0.08 * amount));
      break;
    case 'thinning':
      nextState.fragmentation = clampValue(nextState.fragmentation - (0.2 * amount));
      nextState.glow = clampValue(nextState.glow - (0.1 * amount));
      nextState.stillness = clampValue(nextState.stillness + (0.08 * amount));
      break;
    case 'suspended':
      nextState.stillness = clampValue(nextState.stillness + (0.2 * amount));
      nextState.tension = clampValue(nextState.tension - (0.16 * amount));
      nextState.fragmentation = clampValue(nextState.fragmentation - (0.18 * amount));
      nextState.flowBias = clampValue(nextState.flowBias - (0.12 * amount));
      break;
    case 'holding':
    default:
      break;
  }

  return nextState;
}

function deriveFragmentationTarget(featureSummary: AudioFeatureSummary): number {
  const highBandActivity = clampValue(
    (featureSummary.spectralBrightness * 0.32)
    + (featureSummary.hatRate * 0.28)
    + (featureSummary.transientDensity * 0.18),
  );
  const instability = clampValue(
    (featureSummary.changeStrength * 0.42)
    + (Math.abs(featureSummary.energyTrend) * 0.2)
    + (featureSummary.rhythmActivity * 0.1),
  );
  const agitation = clampValue(
    ((1 - featureSummary.calmIndex) * 0.26)
    + (featureSummary.snareRate * 0.14)
    + (featureSummary.kickRate * 0.06),
  );

  let target = clampValue(
    0.08
    + highBandActivity * 0.44
    + instability * 0.28
    + agitation * 0.2,
  );

  if (featureSummary.sectionState === 'build' || featureSummary.sectionState === 'transition') {
    target = clampValue(target + 0.12);
  }

  if (featureSummary.sectionState === 'drop') {
    target = clampValue(target + 0.04);
  }

  if (featureSummary.sectionState === 'breakdown') {
    target = clampValue(target - 0.18);
  }

  if (featureSummary.phraseState === 'thinning' || featureSummary.phraseState === 'suspended') {
    target = clampValue(target - 0.12);
  }

  if (featureSummary.phraseState === 'lifting') {
    target = clampValue(target + 0.08);
  }

  if (featureSummary.dominantEvent === 'hihat') {
    target = clampValue(target + 0.08);
  } else if (featureSummary.dominantEvent === 'kick') {
    target = clampValue(target - 0.04);
  }

  return target;
}

function deriveStillnessTarget(featureSummary: AudioFeatureSummary): number {
  const calmBed = clampValue(
    (featureSummary.calmIndex * 0.34)
    + (featureSummary.phraseCalmIndex * 0.32)
    + (featureSummary.sectionCalmIndex * 0.12),
  );
  const activityPressure = clampValue(
    (featureSummary.energyLevel * 0.22)
    + (featureSummary.transientDensity * 0.2)
    + (featureSummary.rhythmActivity * 0.14)
    + (Math.max(0, featureSummary.energyTrend) * 0.1),
  );

  let target = clampValue(
    0.16
    + calmBed
    - activityPressure
    - (featureSummary.spectralBrightness * 0.06),
  );

  if (featureSummary.sectionState === 'breakdown') {
    target = clampValue(target + 0.18);
  }

  if (featureSummary.sectionState === 'build' || featureSummary.sectionState === 'drop') {
    target = clampValue(target - 0.14);
  }

  if (featureSummary.sectionState === 'transition') {
    target = clampValue(target - 0.06);
  }

  if (featureSummary.phraseState === 'suspended') {
    target = clampValue(target + 0.14);
  }

  if (featureSummary.phraseState === 'settling') {
    target = clampValue(target + 0.08);
  }

  if (featureSummary.phraseState === 'lifting') {
    target = clampValue(target - 0.08);
  }

  if (featureSummary.dominantEvent === 'hihat') {
    target = clampValue(target - 0.05);
  }

  return target;
}

function shapeAIState(
  parsedState: AIState,
  featureSummary: AudioFeatureSummary,
  context: AIRequestContext = {},
): AIState {
  const previousAIState = context.previousAIState
    ? cloneAIState(context.previousAIState)
    : createDefaultAIState();
  const sectionAnchor = getSectionAnchor(featureSummary.sectionState);
  const anchorStrength = featureSummary.sectionState === 'groove'
    ? (0.16 + (featureSummary.changeStrength * 0.12))
    : (0.34 + (featureSummary.changeStrength * 0.28));
  const phraseStrength = 0.28 + (featureSummary.changeStrength * 0.22);
  const fragmentationTarget = deriveFragmentationTarget(featureSummary);
  const stillnessTarget = deriveStillnessTarget(featureSummary);
  const fragmentationBlend = context.updateReason === 'section-change'
    ? 0.76
    : context.updateReason === 'phrase-change'
      ? 0.62
      : context.updateReason === 'boot'
        ? 0.68
        : 0.44;
  const stillnessBlend = context.updateReason === 'section-change'
    ? 0.72
    : context.updateReason === 'phrase-change'
      ? 0.58
      : context.updateReason === 'boot'
        ? 0.64
        : 0.4;

  let nextState = blendAIState(parsedState, sectionAnchor, anchorStrength);
  nextState = applyPhraseAdjustment(nextState, featureSummary.phraseState, phraseStrength);
  nextState.fragmentation = blendScalar(
    nextState.fragmentation,
    fragmentationTarget,
    fragmentationBlend,
  );
  nextState.stillness = blendScalar(
    nextState.stillness,
    stillnessTarget,
    stillnessBlend,
  );
  nextState = {
    tension: clampExpressiveRange(nextState.tension),
    glow: clampExpressiveRange(nextState.glow),
    fragmentation: clampExpressiveRange(nextState.fragmentation),
    stillness: clampExpressiveRange(nextState.stillness),
    flowBias: clampExpressiveRange(nextState.flowBias),
    warmth: clampExpressiveRange(nextState.warmth),
  };

  if (context.updateReason === 'phrase-refresh' || context.updateReason === 'idle-refresh') {
    return blendAIState(previousAIState, nextState, 0.62);
  }

  return blendAIState(previousAIState, nextState, 0.84);
}

function buildPrompt(
  featureSummary: AudioFeatureSummary,
  context: AIRequestContext = {},
): string {
  return STRICT_PROMPT_TEMPLATE.replace(
    '{{FEATURE_SUMMARY_JSON}}',
    JSON.stringify({
      featureSummary,
      updateReason: context.updateReason || null,
      previousAIState: context.previousAIState || null,
    }),
  );
}

function extractJsonText(rawResponse: string): string | null {
  const trimmed = rawResponse.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const firstBraceIndex = trimmed.indexOf('{');
  const lastBraceIndex = trimmed.lastIndexOf('}');

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || firstBraceIndex >= lastBraceIndex) {
    return null;
  }

  return trimmed.slice(firstBraceIndex, lastBraceIndex + 1);
}

function parseAIStateResponse(
  rawResponse: string,
  fallbackSeedState: AIState = lastValidState,
): AIState | null {
  const jsonText = extractJsonText(rawResponse);

  if (!jsonText) {
    return null;
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(jsonText);
  } catch (error) {
    console.warn('[getAIState] Failed to parse AI JSON response.', error);
    return null;
  }

  console.debug('[getAIState] Parsed JSON:', parsedValue);

  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    return null;
  }

  const parsedRecord = parsedValue as Record<string, unknown>;
  const nextState: Partial<AIState> = {};
  const repairedKeys: string[] = [];
  let validNumericKeyCount = 0;

  for (const key of REQUIRED_AI_STATE_KEYS) {
    const value = parsedRecord[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      nextState[key] = clampValue(value);
      validNumericKeyCount += 1;
      continue;
    }

    nextState[key] = fallbackSeedState[key];
    repairedKeys.push(key);
  }

  if (validNumericKeyCount < 4) {
    return null;
  }

  if (repairedKeys.length > 0) {
    console.warn('[getAIState] Repaired partial AI payload with fallback seed values.', {
      repairedKeys,
      parsedRecord,
    });
  }

  return nextState as AIState;
}

function useFallbackState(reason: string): AIState {
  lastAIRequestMeta = {
    fallbackActive: true,
    receivedAtMs: Date.now(),
    reason,
    backoffUntilMs: lastAIRequestMeta.backoffUntilMs,
  };
  console.warn('[getAIState] Using fallback state:', reason, lastValidState);
  return cloneAIState(lastValidState);
}

export function getDefaultAIState(): AIState {
  return createDefaultAIState();
}

export function getLastValidAIState(): AIState {
  return cloneAIState(lastValidState);
}

export function getLastAIRequestMeta(): AIRequestMeta {
  return {
    ...lastAIRequestMeta,
  };
}

export async function getAIState(
  featureSummary: AudioFeatureSummary,
  context: AIRequestContext = {},
): Promise<AIState> {
  const prompt = buildPrompt(featureSummary, context);
  const runtimeTarget = resolveAIRuntimeTarget();
  const requestBody = runtimeTarget.mode === 'remote'
    ? {
      prompt,
    }
    : {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      keep_alive: '10m',
    };

  try {
    const response = await fetch(runtimeTarget.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response) ?? 60_000;
        lastAIRequestMeta = {
          fallbackActive: true,
          receivedAtMs: Date.now(),
          reason: 'rate-limited',
          backoffUntilMs: Date.now() + retryAfterMs,
        };
      }

      return useFallbackState(`HTTP ${response.status} from ${runtimeTarget.mode} AI runtime.`);
    }

    const payload = (await response.json()) as OllamaGenerateResponse;
    const rawAiResponse = typeof payload.response === 'string' ? payload.response : '';

    console.debug('[getAIState] Raw AI response:', rawAiResponse);

    if (!rawAiResponse) {
      return useFallbackState('Missing response field from Ollama.');
    }

    const nextState = parseAIStateResponse(
      rawAiResponse,
      context.previousAIState ? cloneAIState(context.previousAIState) : cloneAIState(lastValidState),
    );

    if (!nextState) {
      return useFallbackState('Invalid AI state payload.');
    }

    const shapedState = shapeAIState(nextState, featureSummary, context);

    lastValidState = {
      ...shapedState,
    };

    lastAIRequestMeta = {
      fallbackActive: false,
      receivedAtMs: Date.now(),
      reason: null,
      backoffUntilMs: null,
    };

    return cloneAIState(shapedState);
  } catch (error) {
    console.warn('[getAIState] Request failed.', error);
    return useFallbackState(`Request failure from ${runtimeTarget.mode} AI runtime.`);
  }
}
