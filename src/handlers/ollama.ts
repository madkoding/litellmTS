import {
  HandlerParams,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
} from '../types';
import { combinePrompts } from '../utils/combinePrompts';
import { getUnixTimestamp } from '../utils/getUnixTimestamp';
import { toUsage } from '../utils/toUsage';

interface OllamaResponseChunk {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done: boolean;
}

function toStreamingChunk(
  ollamaResponse: OllamaResponseChunk,
  model: string,
  prompt: string,
): StreamingChunk {
  return {
    model: model,
    created: getUnixTimestamp(),
    usage: toUsage(prompt, ollamaResponse.message.content),
    choices: [
      {
        delta: { content: ollamaResponse.message.content, role: 'assistant' },
        finish_reason: 'stop',
        index: 0,
      },
    ],
  };
}

function toResponse(
  content: string,
  model: string,
  prompt: string,
): ResultNotStreaming {
  return {
    model: model,
    created: getUnixTimestamp(),
    usage: toUsage(prompt, content),
    choices: [
      {
        message: { content, role: 'assistant' },
        finish_reason: 'stop',
        index: 0,
      },
    ],
  };
}

async function* iterateResponse(
  response: Response,
  model: string,
  prompt: string,
): AsyncIterable<StreamingChunk> {
  const reader = response.body?.getReader();
  let done = false;

  while (!done) {
    const next = await reader?.read();
    if (next?.value) {
      const decoded = new TextDecoder().decode(next.value);
      done = next.done;
      const lines = decoded.split(/(?<!\\)\n/);
      const ollamaResponses = lines
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as OllamaResponseChunk)
        .map((response) => toStreamingChunk(response, model, prompt));

      yield* ollamaResponses;
    } else {
      done = true;
    }
  }
}

function resolveOllamaBaseUrl(apiKey?: string, baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  if (apiKey || process.env.OLLAMA_API_KEY) return 'https://ollama.com';
  return 'http://localhost:11434';
}

async function getOllamaResponse(
  model: string,
  prompt: string,
  baseUrl: string,
  stream: boolean,
  apiKey?: string,
): Promise<Response> {
  const key = apiKey ?? process.env.OLLAMA_API_KEY;
  const url = resolveOllamaBaseUrl(key, baseUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  return fetch(`${url}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream,
    }),
  });
}

export async function OllamaHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const model = params.model.startsWith('ollama/')
    ? params.model.slice(7)
    : params.model;
  const prompt = combinePrompts(params.messages);

  const res = await getOllamaResponse(model, prompt, params.baseUrl ?? '', !!params.stream, params.apiKey);

  if (!res.ok) {
    throw new Error(
      `Received an error with code ${res.status} from Ollama API.`,
    );
  }

  if (params.stream) {
    return iterateResponse(res, model, prompt);
  }

  const chunks: StreamingChunk[] = [];

  for await (const chunk of iterateResponse(res, model, prompt)) {
    chunks.push(chunk);
  }

  const message = chunks.reduce((acc: string, chunk: StreamingChunk) => {
    return acc + chunk.choices[0].delta.content;
  }, '');

  return toResponse(message, model, prompt);
}

import { registerModelProvider } from '../models/registry';

interface OllamaTag {
  name: string;
}

registerModelProvider('ollama', async ({ baseUrl, apiKey } = {}) => {
  const url = resolveOllamaBaseUrl(apiKey, baseUrl);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  else if (process.env.OLLAMA_API_KEY) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  const res = await fetch(`${url}/api/tags`, { headers });
  if (!res.ok) return [];
  const { models } = (await res.json()) as { models: OllamaTag[] };
  return (models ?? []).map((m) => ({ id: m.name.replace(/-cloud$/, ''), provider: 'ollama' }));
});

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('ollama/', OllamaHandler);
