import type { AIState, AudioFeatureSummary } from '../contracts/aiState.ts';
import { cloneAIState, createDefaultAIState } from '../contracts/aiState.ts';

interface OllamaGenerateResponse {
  response?: string;
}

export interface AIRequestMeta {
  fallbackActive: boolean;
  receivedAtMs: number | null;
  reason: string | null;
}

const OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'qwen2.5:7b-instruct';

const REQUIRED_AI_STATE_KEYS = [
  'tension',
  'glow',
  'fragmentation',
  'stillness',
  'flowBias',
  'warmth',
] as const;

const STRICT_PROMPT_TEMPLATE = `You are a visual-state generator for a real-time audio-reactive visual system.

Your job is to interpret a compact audio/perceptual feature summary and convert it into a stable high-level visual state.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.
Do not include any text outside JSON.

You must return exactly these keys:
tension, glow, fragmentation, stillness, flowBias, warmth

All values must be floats between 0.0 and 1.0.

Interpret the input features into a coherent visual state.
Favor stability over extreme jumps.
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
};

function clampValue(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function buildPrompt(featureSummary: AudioFeatureSummary): string {
  return STRICT_PROMPT_TEMPLATE.replace(
    '{{FEATURE_SUMMARY_JSON}}',
    JSON.stringify(featureSummary),
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

function parseAIStateResponse(rawResponse: string): AIState | null {
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

  for (const key of REQUIRED_AI_STATE_KEYS) {
    const value = parsedRecord[key];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    nextState[key] = clampValue(value);
  }

  return nextState as AIState;
}

function useFallbackState(reason: string): AIState {
  lastAIRequestMeta = {
    fallbackActive: true,
    receivedAtMs: Date.now(),
    reason,
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
): Promise<AIState> {
  const prompt = buildPrompt(featureSummary);

  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        keep_alive: '10m',
      }),
    });

    if (!response.ok) {
      return useFallbackState(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OllamaGenerateResponse;
    const rawAiResponse = typeof payload.response === 'string' ? payload.response : '';

    console.debug('[getAIState] Raw AI response:', rawAiResponse);

    if (!rawAiResponse) {
      return useFallbackState('Missing response field from Ollama.');
    }

    const nextState = parseAIStateResponse(rawAiResponse);

    if (!nextState) {
      return useFallbackState('Invalid AI state payload.');
    }

    lastValidState = {
      ...nextState,
    };

    lastAIRequestMeta = {
      fallbackActive: false,
      receivedAtMs: Date.now(),
      reason: null,
    };

    return cloneAIState(nextState);
  } catch (error) {
    console.warn('[getAIState] Request failed.', error);
    return useFallbackState('Request failure.');
  }
}
