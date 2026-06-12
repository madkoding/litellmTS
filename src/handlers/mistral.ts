import type { ChatCompletion } from 'openai/resources/chat';

import {
  HandlerParams,
  Message,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
  type ConsistentResponse,
} from '../types';
import { iterateSSEStream } from '../utils/sse';

async function getMistralResponse(
  model: string,
  messages: Message[],
  baseUrl: string,
  apiKey: string,
  stream: boolean,
): Promise<Response> {
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages,
      model,
      stream,
    }),
  });
}

export async function MistralHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const baseUrl = params.baseUrl ?? 'https://api.mistral.ai';
  const apiKey = params.apiKey ?? process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('Mistral requires an API key. Set MISTRAL_API_KEY environment variable or pass apiKey in params.');
  const model = params.model.startsWith('mistral/')
    ? params.model.slice(8)
    : params.model;

  const res = await getMistralResponse(
    model,
    params.messages,
    baseUrl,
    apiKey,
    params.stream ?? false,
  );

  if (!res.ok) {
    throw new Error(`Mistral API error: ${res.status} ${res.statusText}`);
  }

  if (params.stream) {
    return iterateSSEStream(res, (payload) => JSON.parse(payload) as StreamingChunk);
  }

  const body = await res.json() as ChatCompletion;

  const result: ConsistentResponse = {
    created: body.created,
    model: body.model,
    choices: body.choices.map((c) => ({
      finish_reason: c.finish_reason,
      index: c.index,
      message: {
        role: c.message.role,
        content: c.message.content,
        function_call: c.message.function_call ?? undefined,
      },
    })),
    usage: body.usage
      ? {
          prompt_tokens: body.usage.prompt_tokens,
          completion_tokens: body.usage.completion_tokens,
          total_tokens: body.usage.total_tokens,
        }
      : undefined,
  };

  return result;
}

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('mistral/', MistralHandler);
