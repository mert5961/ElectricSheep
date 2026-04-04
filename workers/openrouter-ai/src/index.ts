interface Env {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_APP_NAME?: string;
}

interface OpenRouterChatResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

const DEFAULT_MODEL = 'qwen/qwen3.6-plus:free';
const OPENROUTER_CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function parseAllowedOrigins(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveCorsOrigin(request: Request, env: Env): string | null {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);

  if (allowedOrigins.length === 0) {
    return requestOrigin || '*';
  }

  if (!requestOrigin) {
    return allowedOrigins[0] || null;
  }

  if (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)) {
    return allowedOrigins.includes('*') ? '*' : requestOrigin;
  }

  return null;
}

function buildCorsHeaders(request: Request, env: Env): Headers {
  const allowedOrigin = resolveCorsOrigin(request, env);
  const headers = new Headers();

  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
  }

  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');

  return headers;
}

function jsonResponse(
  request: Request,
  env: Env,
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = buildCorsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function extractMessageText(payload: OpenRouterChatResponse): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  return '';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request, env),
      });
    }

    if (url.pathname !== '/ai-state') {
      return jsonResponse(request, env, { error: 'Not found.' }, { status: 404 });
    }

    const allowedOrigin = resolveCorsOrigin(request, env);

    if (!allowedOrigin) {
      return jsonResponse(request, env, { error: 'Origin not allowed.' }, { status: 403 });
    }

    if (request.method !== 'POST') {
      return jsonResponse(request, env, { error: 'Method not allowed.' }, { status: 405 });
    }

    if (!env.OPENROUTER_API_KEY) {
      return jsonResponse(request, env, { error: 'Server is missing OPENROUTER_API_KEY.' }, { status: 500 });
    }

    let prompt = '';

    try {
      const body = await request.json() as { prompt?: unknown };
      prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    } catch (error) {
      return jsonResponse(request, env, { error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (!prompt) {
      return jsonResponse(request, env, { error: 'Prompt is required.' }, { status: 400 });
    }

    if (prompt.length > 16000) {
      return jsonResponse(request, env, { error: 'Prompt exceeds the 16,000 character limit.' }, { status: 413 });
    }

    const upstreamResponse = await fetch(OPENROUTER_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        ...(env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': env.OPENROUTER_SITE_URL } : {}),
        ...(env.OPENROUTER_APP_NAME ? { 'X-Title': env.OPENROUTER_APP_NAME } : {}),
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!upstreamResponse.ok) {
      const upstreamText = (await upstreamResponse.text()).slice(0, 500);

      return jsonResponse(
        request,
        env,
        {
          error: 'OpenRouter request failed.',
          details: upstreamText,
        },
        { status: upstreamResponse.status },
      );
    }

    const payload = await upstreamResponse.json() as OpenRouterChatResponse;
    const responseText = extractMessageText(payload);

    if (!responseText) {
      return jsonResponse(request, env, { error: 'OpenRouter returned an empty message.' }, { status: 502 });
    }

    return jsonResponse(request, env, {
      provider: 'openrouter',
      model: payload.model || env.OPENROUTER_MODEL || DEFAULT_MODEL,
      response: responseText,
    });
  },
};
