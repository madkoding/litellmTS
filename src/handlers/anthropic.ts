import Anthropic from '@anthropic-ai/sdk';

import type { HandlerParams, ResultNotStreaming, ResultStreaming } from '../types';
import {
  toAnthropicMessages,
  toAnthropicResponse,
  toAnthropicStreamingResponse,
} from '../utils/anthropic';
import { getAnthropicKey } from '../auth';
import { registerModelProvider } from '../models/registry';

export async function AnthropicHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.ANTHROPIC_API_KEY ?? (await getAnthropicKey());
  const modelName = params.model.startsWith('anthropic/')
    ? params.model.slice(10)
    : params.model;

  const anthropic = new Anthropic({ apiKey });

  const { system, messages } = toAnthropicMessages(params.messages);

  const anthropicParams: Anthropic.MessageCreateParams = {
    model: modelName,
    max_tokens: params.max_tokens ?? 300,
    messages,
    ...(system ? { system } : {}),
  };

  try {
    if (params.stream) {
      const stream = await anthropic.messages.create({
        ...anthropicParams,
        stream: true,
      });
      return toAnthropicStreamingResponse(stream);
    }

    const message = await anthropic.messages.create(anthropicParams);
    return toAnthropicResponse(message);
  } catch (err) {
    throw new Error(`Anthropic API error: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
}

registerModelProvider('anthropic', async ({ apiKey } = {}) => {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) return [];
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  });
  const { data } = await res.json();
  return data.map((m: any) => ({ id: m.id, provider: 'anthropic' }));
});

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('anthropic/', AnthropicHandler);
