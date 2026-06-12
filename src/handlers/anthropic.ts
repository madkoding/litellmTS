import Anthropic from '@anthropic-ai/sdk';

import {
  HandlerParams,
  ResultStreaming,
  ResultNotStreaming,
  StreamingChunk,
  Message,
  FinishReason,
} from '../types';
import { getUnixTimestamp } from '../utils/getUnixTimestamp';
import { toUsage } from '../utils/toUsage';
import { getAnthropicKey } from '../auth';

function toAnthropicPrompt(messages: Message[]): string {
  return messages
    .map((msg) => {
      const content = msg.content ?? '';
      if (msg.role === 'assistant') {
        return `${Anthropic.AI_PROMPT} ${content}`;
      }
      return `${Anthropic.HUMAN_PROMPT} ${content}`;
    })
    .join('') + Anthropic.AI_PROMPT;
}

function toFinishReson(string: string | null | undefined): FinishReason {
  if (string === 'max_tokens') {
    return 'length';
  }

  return 'stop';
}

function toResponse(
  anthropicResponse: Anthropic.Completion,
  prompt: string,
): ResultNotStreaming {
  return {
    model: anthropicResponse.model,
    created: getUnixTimestamp(),
    usage: toUsage(prompt, anthropicResponse.completion),
    choices: [
      {
        message: {
          content: anthropicResponse.completion,
          role: 'assistant',
        },
        finish_reason: toFinishReson(anthropicResponse.stop_reason),
        index: 0,
      },
    ],
  };
}

function toStreamingChunk(
  anthropicResponse: Anthropic.Completion,
): StreamingChunk {
  return {
    model: anthropicResponse.model,
    created: getUnixTimestamp(),
    choices: [
      {
        delta: { content: anthropicResponse.completion, role: 'assistant' },
        finish_reason: toFinishReson(anthropicResponse.stop_reason),
        index: 0,
      },
    ],
  };
}

async function* toStreamingResponse(
  stream: AsyncIterable<Anthropic.Completion>,
): ResultStreaming {
  for await (const chunk of stream) {
    yield toStreamingChunk(chunk);
  }
}

export async function AnthropicHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.ANTHROPIC_API_KEY ?? (await getAnthropicKey());

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });
  const prompt = toAnthropicPrompt(params.messages);

  const anthropicParams = {
    model: params.model,
    max_tokens_to_sample: params.max_tokens ?? 300,
    prompt,
  };

  if (params.stream) {
    const completionStream = await anthropic.completions.create({
      ...anthropicParams,
      stream: params.stream,
    });
    return toStreamingResponse(completionStream);
  }

  const completion = await anthropic.completions.create(anthropicParams);

  return toResponse(completion, prompt);
}

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('claude-', AnthropicHandler);
