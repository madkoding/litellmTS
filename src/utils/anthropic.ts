import type Anthropic from '@anthropic-ai/sdk';

import type {
  Message,
  FinishReason,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
} from '../types';
import { getUnixTimestamp } from './getUnixTimestamp';

export function toAnthropicMessages(input: Message[]): { system: string | undefined; messages: Anthropic.MessageParam[] } {
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

export function toAnthropicFinishReason(reason: Anthropic.StopReason | null | undefined): FinishReason {
  return reason === 'max_tokens' ? 'length' : 'stop';
}

export function getTextContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export function toAnthropicResponse(message: Anthropic.Message): ResultNotStreaming {
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
        finish_reason: toAnthropicFinishReason(message.stop_reason),
        index: 0,
      },
    ],
  };
}

export async function* toAnthropicStreamingResponse(
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
          const chunk: StreamingChunk = {
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
          yield chunk;
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
              finish_reason: toAnthropicFinishReason(stopReason),
              index: 0,
            },
          ],
        };
        break;
    }
  }
}
