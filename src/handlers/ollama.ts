import {
  HandlerParams,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
} from '../types';

import { toUsage } from '../utils/toUsage';
import { renderQwenTemplate } from '../utils/renderQwenTemplate';

/* ── Qwen /api/generate helpers ── */

interface QwenGenerateChunk {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

/** Split leading `<think>…</think>\n\n` block, returning [content, reasoning]. */
function splitThinkBlock(raw: string): [content: string, reasoning: string] {
  const idx = raw.indexOf('\n</think>\n\n');
  if (idx !== -1) {
    return [
      raw.slice(idx + '\n</think>\n\n'.length),
      raw.slice(0, idx),
    ];
  }
  return [raw, ''];
}

async function* iterateQwenGenerate(
  response: Response,
  model: string,
  prompt: string,
  thinkingEnabled: boolean,
): AsyncIterable<StreamingChunk> {
  const reader = response.body?.getReader();
  let done = false;
  let buffer = '';
  let state: 'thinking' | 'content' = thinkingEnabled ? 'thinking' : 'content';
  let lastError = '';

  while (!done) {
    const next = await reader?.read();
    if (next?.value) {
      const decoded = new TextDecoder().decode(next.value);
      done = next.done;
      const lines = decoded.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as QwenGenerateChunk;
          buffer += parsed.response;

          if (state === 'thinking') {
            const idx = buffer.indexOf('\n</think>\n\n');
            if (idx !== -1) {
              state = 'content';
              const reasoning = buffer.slice(0, idx);
              buffer = buffer.slice(idx + '\n</think>\n\n'.length);
              if (reasoning.trim()) {
                yield toStreamingChunkFromDelta('', model, prompt, undefined, reasoning);
              }
            } else {
              continue;
            }
          }

          if (state === 'content' && buffer) {
            yield toStreamingChunkFromDelta(buffer, model, prompt);
            buffer = '';
          }
        } catch (e: any) {
          lastError = `Failed to parse generate chunk: ${(e.message || e).slice(0, 100)} | raw: ${trimmed.slice(0, 200)}`;
        }
      }
    } else {
      done = true;
    }
  }

  /* flush remaining buffer (e.g. thinking never closed) */
  if (buffer) {
    yield toStreamingChunkFromDelta(buffer, model, prompt);
  }

  if (lastError) {
    console.error(`[iterateQwenGenerate] ${lastError}`);
  }
}

async function getQwenGenerateResponse(
  model: string,
  rendered: string,
  baseUrl: string,
  stream: boolean,
  apiKey?: string,
  maxTokens?: number | null,
  temperature?: number | null,
  topP?: number | null,
  repetitionPenalty?: number | null,
  frequencyPenalty?: number | null,
  topK?: number | null,
): Promise<{ response: Response; endpoint: string }> {
  const key = apiKey ?? process.env.OLLAMA_API_KEY;
  const url = baseUrl
    ? baseUrl.replace(/\/api\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '')
    : key ? 'https://ollama.com' : 'http://localhost:11434';
  const endpoint = `${url}/api/generate`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model,
    prompt: rendered,
    stream,
    raw: true,
  };
  body.options = {
    num_ctx: 32768,
    num_predict: maxTokens ?? 32768,
    top_p: topP ?? 0.9,
    top_k: topK ?? 40,
    repeat_penalty: repetitionPenalty ?? 1.1,
  };
  if (temperature != null) (body.options as Record<string, unknown>).temperature = temperature;
  if (frequencyPenalty != null) (body.options as Record<string, unknown>).frequency_penalty = frequencyPenalty;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { response, endpoint };
}

async function qwenCompletionPath(
  params: HandlerParams,
  model: string,
): Promise<ResultNotStreaming | ResultStreaming> {
  const thinkingEnabled = (params as any).think !== false;
  const rendered = renderQwenTemplate({
    messages: params.messages,
    tools: params.tools,
    addGenerationPrompt: true,
    enableThinking: thinkingEnabled,
  });

  const { response: res, endpoint } = await getQwenGenerateResponse(
    model,
    rendered,
    params.baseUrl ?? '',
    !!params.stream,
    params.apiKey,
    params.max_tokens,
    params.temperature,
    params.top_p,
    params.repetition_penalty,
    params.frequency_penalty,
    params.top_k,
  );

  if (!res.ok) {
    let errorBody = '';
    try { errorBody = await res.text(); } catch { errorBody = ''; }
    const prefix = `[Ollama/Qwen] Endpoint: ${endpoint} | Model: ${model}`;
    let detail = `HTTP ${res.status}`;
    if (errorBody) {
      try {
        const parsed = JSON.parse(errorBody);
        detail = parsed.error?.message || parsed.error || errorBody;
      } catch {
        detail = errorBody.slice(0, 500);
      }
    }
    throw new Error(`${prefix} | Error: ${detail}`);
  }

  if (params.stream) {
    return iterateQwenGenerate(res, model, rendered, thinkingEnabled);
  }

  const data = (await res.json()) as QwenGenerateChunk;
  const [content, reasoning] = splitThinkBlock(data.response);
  return toResponse(content, model, rendered, undefined, reasoning);
}

interface OllamaResponseChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    thinking?: string;
    tool_calls?: Array<{
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  };
  done: boolean;
}

interface OpenAIChatChunk {
  choices: Array<{
    index: number;
    delta?: {
      role?: string;
      content?: string;
      reasoning?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
    message?: {
      role: string;
      content?: string;
      reasoning?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
}

function toStreamingChunk(
  ollamaResponse: OllamaResponseChunk,
  model: string,
  prompt: string,
): StreamingChunk {
  const tc = ollamaResponse.message.tool_calls;
  return {
    model: model,
    created: Math.floor(Date.now() / 1000),
    usage: toUsage(prompt, ollamaResponse.message.content),
    choices: [
      {
        delta: {
          content: ollamaResponse.message.content,
          role: 'assistant',
          tool_calls: tc ? tc.map(t => ({
            id: t.function.name,
            type: 'function' as const,
            function: { name: t.function.name, arguments: t.function.arguments },
          })) : undefined,
          reasoning: ollamaResponse.message.thinking,
        },
        finish_reason: 'stop',
        index: 0,
      },
    ],
  };
}

function toStreamingChunkFromDelta(
  content: string,
  model: string,
  prompt: string,
  toolCalls?: Array<{ id?: string; type?: 'function'; function?: { name?: string; arguments?: string } }>,
  reasoning?: string,
): StreamingChunk {
  return {
    model: model,
    created: Math.floor(Date.now() / 1000),
    usage: toUsage(prompt, content),
    choices: [
      {
        delta: {
          content,
          role: 'assistant',
          tool_calls: toolCalls as any,
          reasoning,
        },
        finish_reason: null,
        index: 0,
      },
    ],
  };
}

function toResponse(
  content: string,
  model: string,
  prompt: string,
  toolCalls?: Array<{ type: 'function'; function: { name: string; arguments: string } }>,
  reasoning?: string,
): ResultNotStreaming {
  return {
    model: model,
    created: Math.floor(Date.now() / 1000),
    usage: toUsage(prompt, content),
    choices: [
      {
        message: {
          content,
          role: 'assistant',
          tool_calls: toolCalls as any,
          ...(reasoning ? { reasoning } : {}),
        },
        finish_reason: toolCalls ? 'tool_calls' : 'stop',
        index: 0,
      },
    ],
  };
}

async function* iterateResponse(
  response: Response,
  model: string,
  prompt: string,
  useOpenAIEndpoint: boolean,
): AsyncIterable<StreamingChunk> {
  const reader = response.body?.getReader();
  let done = false;
  let lastError = '';

  while (!done) {
    const next = await reader?.read();
    if (next?.value) {
      const decoded = new TextDecoder().decode(next.value);
      done = next.done;
      const lines = decoded.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
if (useOpenAIEndpoint) {
            if (trimmed === 'data: [DONE]') return;
            const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
            try {
              const parsed = JSON.parse(jsonStr) as OpenAIChatChunk;
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                yield toStreamingChunkFromDelta(delta.content, model, prompt);
              }
              if (delta?.reasoning) {
                yield toStreamingChunkFromDelta('', model, prompt, undefined, delta.reasoning);
              }
              if (delta?.tool_calls) {
                yield toStreamingChunkFromDelta('', model, prompt, delta.tool_calls);
              }
          } catch (e: any) {
            lastError = `Failed to parse SSE chunk: ${(e.message || e).slice(0, 100)} | raw: ${trimmed.slice(0, 200)}`;
          }
        } else {
          try {
            yield toStreamingChunk(JSON.parse(trimmed) as OllamaResponseChunk, model, prompt);
          } catch (e: any) {
            lastError = `Failed to parse Ollama chunk: ${(e.message || e).slice(0, 100)} | raw: ${trimmed.slice(0, 200)}`;
          }
        }
      }
    } else {
      done = true;
    }
  }

  if (lastError) {
    console.error(`[iterateResponse] ${lastError}`);
  }
}

function resolveOllamaBaseUrl(apiKey?: string, baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/api\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '');
  if (apiKey || process.env.OLLAMA_API_KEY) return 'https://ollama.com';
  return 'http://localhost:11434';
}

async function getOllamaResponse(
  model: string,
  messages: Array<{ role: string; content: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }>,
  baseUrl: string,
  stream: boolean,
  apiKey?: string,
  maxTokens?: number | null,
  temperature?: number | null,
  topP?: number | null,
  tools?: HandlerParams['tools'],
  think?: boolean | null,
  repetitionPenalty?: number | null,
  frequencyPenalty?: number | null,
  topK?: number | null,
): Promise<{ response: Response; useOpenAIEndpoint: boolean; endpoint: string; hasApiKey: boolean; model: string }> {
  const key = apiKey ?? process.env.OLLAMA_API_KEY;
  const url = resolveOllamaBaseUrl(key, baseUrl);
  const cloud = !!key;
  const hasTools = tools !== undefined && tools.length > 0;
  const useOpenAIEndpoint: boolean = cloud ? true : hasTools;
  const endpoint = useOpenAIEndpoint ? `${url}/v1/chat/completions` : `${url}/api/chat`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) headers.Authorization = `Bearer ${key}`;

  const body: Record<string, unknown> = { model, messages, stream };
  if (useOpenAIEndpoint) {
    if (maxTokens) body.max_tokens = maxTokens;
    if (temperature != null) body.temperature = temperature;
    if (topP != null) body.top_p = topP;
    if (repetitionPenalty != null) body.repetition_penalty = repetitionPenalty;
    if (frequencyPenalty != null) body.frequency_penalty = frequencyPenalty;
    if (hasTools) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    if (think != null) body.think = think;
  } else {
    body.options = {
      num_ctx: 32768,
      num_predict: maxTokens ?? 32768,
      top_p: topP ?? 0.9,
      top_k: topK ?? 40,
      repeat_penalty: repetitionPenalty ?? 1.1,
    };
    if (temperature != null) (body.options as Record<string, unknown>).temperature = temperature;
    if (think != null) body.think = think;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { response, useOpenAIEndpoint, endpoint, hasApiKey: !!key, model };
}

export async function OllamaHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  let model = params.model.startsWith('ollama/')
    ? params.model.slice(7)
    : params.model.startsWith('ollama_local/')
      ? params.model.slice(13)
      : params.model;

  /* Qwen models use rendered chat template + /api/generate */
  if (/qwen/i.test(model)) {
    return qwenCompletionPath(params, model);
  }

  const messages = params.messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role, content: m.content || '' };
    if (m.name) msg.name = m.name;
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if ((m as any).tool_calls) {
      msg.tool_calls = (m as any).tool_calls;
    } else if ((m as any).function_call) {
      const fc = (m as any).function_call;
      msg.tool_calls = [{ id: fc.name || 'call_0', type: 'function', function: { name: fc.name, arguments: fc.arguments } }];
    }
    if (m.role === 'function') {
      msg.role = 'tool';
      if (!msg.tool_call_id && m.name) msg.tool_call_id = m.name;
    }
    return msg;
  });
  const prompt = params.messages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'Human'}: ${m.content ?? ''}`)
    .join('\n\n');

  const { response: res, useOpenAIEndpoint, endpoint, hasApiKey, model: actualModel } = await getOllamaResponse(model, messages as any, params.baseUrl ?? '', !!params.stream, params.apiKey, params.max_tokens, params.temperature, params.top_p, params.tools, (params as any).think, params.repetition_penalty, params.frequency_penalty, params.top_k);

  if (!res.ok) {
    let errorBody = '';
    try { errorBody = await res.text(); } catch { errorBody = ''; }
    const prefix = `[Ollama] Endpoint: ${endpoint} | Model: ${actualModel} | HasApiKey: ${hasApiKey}`;
    let detail = `HTTP ${res.status}`;
    if (errorBody) {
      try {
        const parsed = JSON.parse(errorBody);
        detail = parsed.error?.message || parsed.error || errorBody;
      } catch {
        detail = errorBody.slice(0, 500);
      }
    }
    throw new Error(`${prefix} | Error: ${detail}`);
  }

  if (params.stream) {
    return iterateResponse(res, model, prompt, useOpenAIEndpoint);
  }

  if (useOpenAIEndpoint) {
    const body = (await res.json()) as OpenAIChatChunk;
    const choice = body.choices?.[0];
    const content = choice?.message?.content || choice?.message?.reasoning || '';
    const toolCalls = choice?.message?.tool_calls;
    return toResponse(content, model, prompt, toolCalls);
  }

  const data = (await res.json()) as OllamaResponseChunk;
  return toResponse(data.message.content, model, prompt, data.message.tool_calls as any, data.message.thinking);
}

import { registerModelProvider } from '../models';

interface OllamaTag {
  name: string;
}

type ModelFetcherType = (params?: { apiKey?: string; baseUrl?: string }) => Promise<Array<{ id: string; provider: string }>>;

function makeOllamaModelProvider(provider: string): ModelFetcherType {
  return async ({ baseUrl, apiKey } = {}) => {
    const url = resolveOllamaBaseUrl(apiKey, baseUrl);
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    else if (process.env.OLLAMA_API_KEY) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
    const res = await fetch(`${url}/api/tags`, { headers });
    if (!res.ok) return [];
    const { models } = (await res.json()) as { models: OllamaTag[] };
    return (models ?? []).map((m) => ({ id: m.name.replace(/-cloud$/, ''), provider }));
  };
}

registerModelProvider('ollama', makeOllamaModelProvider('ollama'));
registerModelProvider('ollama_local', makeOllamaModelProvider('ollama_local'));

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('ollama/', OllamaHandler);
registerCompletionHandler('ollama_local/', OllamaHandler);
