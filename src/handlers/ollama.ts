import {
  HandlerParams,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
} from '../types';
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
      const lines = decoded.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield toStreamingChunk(JSON.parse(trimmed) as OllamaResponseChunk, model, prompt);
        } catch {
          // Skip malformed JSON lines (e.g. partial chunks across reads)
        }
      }
    } else {
      done = true;
    }
  }
}

function resolveOllamaBaseUrl(apiKey?: string, baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/api\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '');
  if (apiKey || process.env.OLLAMA_API_KEY) return 'https://ollama.com';
  return 'http://localhost:11434';
}

async function getOllamaResponse(
  model: string,
  messages: Array<{ role: string; content: string }>,
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
      messages,
      stream,
    }),
  });
}

export async function OllamaHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  let model = params.model.startsWith('ollama/')
    ? params.model.slice(7)
    : params.model;
  const apiKey = params.apiKey ?? process.env.OLLAMA_API_KEY;
  // Ollama Cloud requires -cloud suffix on model names
  if (apiKey && !model.endsWith('-cloud')) {
    model = model + '-cloud';
  }
  const messages = params.messages.map((m) => ({
    role: m.role,
    content: m.content || '',
  }));
  const prompt = params.messages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'Human'}: ${m.content ?? ''}`)
    .join('\n\n');

  const res = await getOllamaResponse(model, messages, params.baseUrl ?? '', !!params.stream, params.apiKey);

  if (!res.ok) {
    throw new Error(
      `Received an error with code ${res.status} from Ollama API.`,
    );
  }

  if (params.stream) {
    return iterateResponse(res, model, prompt);
  }

  const data = (await res.json()) as OllamaResponseChunk;
  return toResponse(data.message.content, model, prompt);
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
