import type Anthropic from '@anthropic-ai/sdk';

import type {
  Message,
  FinishReason,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
} from '../types';
import { nowSec } from './nowSec';
import { safeParseArgs } from './safeParseArgs';

export function toAnthropicMessages(input: Message[]): {
  system: string | undefined;
  messages: Anthropic.MessageParam[];
} {
  let system: string | undefined;
  const messages: Anthropic.MessageParam[] = [];

  for (const msg of input) {
    if (msg.role === 'system') {
      system = (system ? system + '\n' : '') + (msg.content ?? '');
      continue;
    }

    if (msg.role === 'user') {
      messages.push({
        role: 'user',
        content: msg.content ?? '',
      });
      continue;
    }

    if (msg.role === 'assistant') {
      const content: Anthropic.ContentBlock[] = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content } as Anthropic.TextBlock);
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const parsedArgs = safeParseArgs(tc.function.arguments);
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: parsedArgs,
          } as Anthropic.ToolUseBlock);
        }
      }
      messages.push({
        role: 'assistant',
        content: content.length > 0 ? content : (msg.content ?? ''),
      });
      continue;
    }

    if (msg.role === 'tool') {
      const content: Anthropic.ContentBlock[] = [];
      if (msg.content) {
        content.push({
          type: 'tool_result',
          tool_use_id: msg.tool_call_id ?? '',
          content: msg.content,
        } as any);
      }
      messages.push({
        role: 'user',
        content,
      });
      continue;
    }
  }

  return { system, messages };
}

export function toAnthropicTools(
  tools?: {
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }[],
): Anthropic.Tool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? '',
    input_schema: {
      type: 'object' as const,
      ...((t.function.parameters ?? {}) as Record<string, unknown>),
    } as Anthropic.Tool.InputSchema,
  }));
}

export function toAnthropicToolChoice(
  toolChoice?: 'none' | 'auto' | { type: 'function'; function: { name: string } },
): Anthropic.MessageCreateParams['tool_choice'] | undefined {
  if (!toolChoice) return undefined;
  if (toolChoice === 'none') return { type: 'none' };
  if (toolChoice === 'auto') return { type: 'auto' };
  if (typeof toolChoice === 'object' && 'function' in toolChoice) {
    return { type: 'tool', name: toolChoice.function.name };
  }
  return undefined;
}

export function toAnthropicFinishReason(reason: Anthropic.StopReason | null | undefined): FinishReason {
  if (reason === 'end_turn') return 'stop';
  if (reason === 'tool_use') return 'tool_calls';
  if (reason === 'max_tokens') return 'length';
  if (reason === 'stop_sequence') return 'stop';
  return 'stop';
}

export function getTextContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export function getToolCalls(
  content: Anthropic.ContentBlock[],
): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> {
  const toolUseBlocks = content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  return toolUseBlocks.map((block) => ({
    id: block.id,
    type: 'function' as const,
    function: {
      name: block.name,
      arguments: JSON.stringify(block.input),
    },
  }));
}

export function toAnthropicResponse(message: Anthropic.Message): ResultNotStreaming {
  const toolCalls = getToolCalls(message.content);
  return {
    model: message.model,
    created: nowSec(),
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
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
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
  const toolUseAccumulators: Map<number, { id: string; name: string; input: string }> = new Map();

  for await (const event of stream) {
    switch (event.type) {
      case 'message_start':
        model = event.message.model;
        stopReason = event.message.stop_reason;
        break;

      case 'content_block_start': {
        if (event.content_block.type === 'thinking') {
          break;
        }
        if (event.content_block.type === 'tool_use') {
          const inputStr = JSON.stringify(event.content_block.input);
          toolUseAccumulators.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            input: inputStr,
          });
          const chunk: StreamingChunk = {
            model,
            created: nowSec(),
            choices: [
              {
                delta: {
                  content: '',
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: event.content_block.id,
                      type: 'function',
                      function: {
                        name: event.content_block.name,
                        arguments: inputStr,
                      },
                    },
                  ],
                },
                finish_reason: null,
                index: 0,
              },
            ],
          };
          yield chunk;
        }
        break;
      }

      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          const chunk: StreamingChunk = {
            model,
            created: nowSec(),
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
        if (event.delta.type === 'thinking_delta') {
          const chunk: StreamingChunk = {
            model,
            created: nowSec(),
            choices: [
              {
                delta: { content: null, reasoning: (event.delta as any).thinking, role: 'assistant' },
                finish_reason: null,
                index: 0,
              },
            ],
          };
          yield chunk;
        }
        if (event.delta.type === 'input_json_delta') {
          const acc = toolUseAccumulators.get(event.index);
          if (acc) {
            acc.input += event.delta.partial_json;
          }
        }
        break;

      case 'content_block_stop': {
        const acc = toolUseAccumulators.get(event.index);
        if (acc) {
          let parsedInput: unknown;
          try {
            parsedInput = JSON.parse(acc.input);
          } catch {
            parsedInput = acc.input;
          }
          const chunk: StreamingChunk = {
            model,
            created: nowSec(),
            choices: [
              {
                delta: {
                  content: '',
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: acc.id,
                      type: 'function',
                      function: {
                        name: acc.name,
                        arguments: JSON.stringify(parsedInput),
                      },
                    },
                  ],
                },
                finish_reason: null,
                index: 0,
              },
            ],
          };
          yield chunk;
          toolUseAccumulators.delete(event.index);
        }
        break;
      }

      case 'message_delta':
        stopReason = event.delta.stop_reason;
        break;

      case 'message_stop':
        yield {
          model,
          created: nowSec(),
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
