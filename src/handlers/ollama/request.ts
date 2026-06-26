import { resolveOllamaBaseUrl } from './url';

export async function getQwenGenerateResponse(
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

export async function getOllamaResponse(
  model: string,
  messages: { role: string; content: string; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[] }[],
  baseUrl: string,
  stream: boolean,
  apiKey?: string,
  maxTokens?: number | null,
  temperature?: number | null,
  topP?: number | null,
  tools?: { type: 'function'; function: { name: string; description?: string; parameters?: Record<string, unknown> } }[],
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
