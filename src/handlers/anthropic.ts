import Anthropic from '@anthropic-ai/sdk';

import {
  HandlerParams,
  ResultStreaming,
  ResultNotStreaming,
  Message,
  FinishReason,
} from '../types';
import { getUnixTimestamp } from '../utils/getUnixTimestamp';
import { getAnthropicKey } from '../auth';

function toMessages(input: Message[]): { system: string | undefined; messages: Anthropic.MessageParam[] } {
  let system: string | undefined;
  const messages: Anthropic.MessageParam[] = [];

  for (const msg of input) {
    if (msg.role === 'system') {
      system = (system ? system + '\n' : '') + (msg.content ?? '');
      continue;
    }
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: msg.content ?? '',
      });
    }
  }

  return { system, messages };
}

function toFinishReason(reason: Anthropic.StopReason | null | undefined): FinishReason {
  if (reason === 'max_tokens') {
    return 'length';
  }

  return 'stop';
}

function getTextContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function toResponse(
  message: Anthropic.Message,
): ResultNotStreaming {
  return {
    model: message.model,
    created: getUnixTimestamp(),
    usage: {
      prompt_tokens: message.usage.input_tokens,
      completion_tokens: message.usage.output_tokens,
      total_tokens: message.usage.input_tokens + message.usage.output_tokens,
    },
    choices: [
      {
        message: {
          content: getTextContent(message.content),
          role: 'assistant',
        },
        finish_reason: toFinishReason(message.stop_reason),
        index: 0,
      },
    ],
  };
}

async function* toStreamingResponse(
  stream: AsyncIterable<Anthropic.RawMessageStreamEvent>,
): ResultStreaming {
  let model = '';
  let stopReason: Anthropic.StopReason | null | undefined;

  for await (const event of stream) {
    switch (event.type) {
      case 'message_start':
        model = event.message.model;
        stopReason = event.message.stop_reason;
        break;

      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          yield {
            model,
            created: getUnixTimestamp(),
            choices: [
              {
                delta: { content: event.delta.text, role: 'assistant' },
                finish_reason: null,
                index: 0,
              },
            ],
          };
        }
        break;

      case 'message_delta':
        stopReason = event.delta.stop_reason;
        break;

      case 'message_stop':
        yield {
          model,
          created: getUnixTimestamp(),
          choices: [
            {
              delta: { content: '', role: 'assistant' },
              finish_reason: toFinishReason(stopReason),
              index: 0,
            },
          ],
        };
        break;
    }
  }
}

export async function AnthropicHandler(
  params: HandlerParams,
): Promise<ResultNotStreaming | ResultStreaming> {
  const apiKey = params.apiKey ?? process.env.ANTHROPIC_API_KEY ?? (await getAnthropicKey());

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const { system, messages } = toMessages(params.messages);

  const anthropicParams: Anthropic.MessageCreateParams = {
    model: params.model,
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
      return toStreamingResponse(stream);
    }

    const message = await anthropic.messages.create(anthropicParams);

    return toResponse(message);
  } catch (err) {
    throw new Error(`Anthropic API error: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
}

import { registerCompletionHandler } from '../registry';
registerCompletionHandler('claude-', AnthropicHandler);
