import { resolveOllamaBaseUrl, OLLAMA_CLOUD_URL, OLLAMA_LOCAL_URL } from './url';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

function defaultOllamaOptions(opts: {
  maxTokens?: number | null;
  topP?: number | null;
  topK?: number | null;
  repetitionPenalty?: number | null;
}): Record<string, unknown> {
  return {
    num_ctx: 32768,
    num_predict: opts.maxTokens ?? 32768,
    top_p: opts.topP ?? 0.9,
    top_k: opts.topK ?? 40,
    repeat_penalty: opts.repetitionPenalty ?? 1.1,
  };
}

export interface QwenGenerateOptions {
  model: string;
  rendered: string;
  baseUrl?: string;
  stream?: boolean;
  apiKey?: string;
  maxTokens?: number | null;
  temperature?: number | null;
  topP?: number | null;
  repetitionPenalty?: number | null;
  frequencyPenalty?: number | null;
  topK?: number | null;
}

export async function getQwenGenerateResponse(
  opts: QwenGenerateOptions,
): Promise<{ response: Response; endpoint: string }> {
  const { model, rendered, baseUrl, stream, apiKey, maxTokens, temperature, topP, repetitionPenalty, frequencyPenalty, topK } = opts;
  const key = apiKey ?? process.env.OLLAMA_API_KEY;
  const url = baseUrl
    ? baseUrl.replace(/\/api\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '')
    : key ? OLLAMA_CLOUD_URL : OLLAMA_LOCAL_URL;
  const endpoint = `${url}/api/generate`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model,
    prompt: rendered,
    stream: stream ?? false,
    raw: true,
  };
  body.options = defaultOllamaOptions({ maxTokens, topP, topK, repetitionPenalty });
  if (temperature != null) (body.options as Record<string, unknown>).temperature = temperature;
  if (frequencyPenalty != null) (body.options as Record<string, unknown>).frequency_penalty = frequencyPenalty;

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { response, endpoint };
}

export interface OllamaRequestOptions {
  model: string;
  messages: { role: string; content: string; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[] }[];
  baseUrl?: string;
  stream?: boolean;
  apiKey?: string;
  maxTokens?: number | null;
  temperature?: number | null;
  topP?: number | null;
  tools?: { type: 'function'; function: { name: string; description?: string; parameters?: Record<string, unknown> } }[];
  think?: boolean | null;
  repetitionPenalty?: number | null;
  frequencyPenalty?: number | null;
  topK?: number | null;
}

export async function getOllamaResponse(
  opts: OllamaRequestOptions,
): Promise<{ response: Response; useOpenAIEndpoint: boolean; endpoint: string; hasApiKey: boolean; model: string }> {
  const { model, messages, baseUrl, stream, apiKey, maxTokens, temperature, topP, tools, think, repetitionPenalty, frequencyPenalty, topK } = opts;
  const key = apiKey ?? process.env.OLLAMA_API_KEY;
  const url = resolveOllamaBaseUrl(key, baseUrl ?? '');
  const cloud = !!key;
  const hasTools = tools !== undefined && tools.length > 0;
  const useOpenAIEndpoint: boolean = cloud ? true : hasTools;
  const endpoint = useOpenAIEndpoint ? `${url}/v1/chat/completions` : `${url}/api/chat`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) headers.Authorization = `Bearer ${key}`;

  const body: Record<string, unknown> = { model, messages, stream: stream ?? false };
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
    body.options = defaultOllamaOptions({ maxTokens, topP, topK, repetitionPenalty });
    if (temperature != null) (body.options as Record<string, unknown>).temperature = temperature;
    if (think != null) body.think = think;
  }

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { response, useOpenAIEndpoint, endpoint, hasApiKey: !!key, model };
}
