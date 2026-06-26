import { StreamingChunk, ResultNotStreaming } from '../../types';
import { toUsage } from '../../utils/toUsage';
import { nowSec } from '../../utils/nowSec';
import { OllamaResponseChunk } from './types';

export function toStreamingChunk(
  ollamaResponse: OllamaResponseChunk,
  model: string,
  prompt: string,
): StreamingChunk {
  const tc = ollamaResponse.message.tool_calls;
  return {
    model,
    created: nowSec(),
    usage: toUsage(prompt, ollamaResponse.message.content),
    choices: [
      {
        delta: {
          content: ollamaResponse.message.content,
          role: 'assistant',
          tool_calls: tc ? tc.map(t => ({
            id: t.function.name,
            type: 'function' as const,
            function: { name: t.function.name, arguments: t.function.arguments },
          })) : undefined,
          reasoning: ollamaResponse.message.thinking,
        },
        finish_reason: 'stop',
        index: 0,
      },
    ],
  };
}

export function toStreamingChunkFromDelta(
  content: string,
  model: string,
  prompt: string,
  toolCalls?: Array<{ id?: string; type?: 'function'; function?: { name?: string; arguments?: string } }>,
  reasoning?: string,
): StreamingChunk {
  return {
    model,
    created: nowSec(),
    usage: toUsage(prompt, content),
    choices: [
      {
        delta: {
          content,
          role: 'assistant',
          tool_calls: toolCalls as any,
          reasoning,
        },
        finish_reason: null,
        index: 0,
      },
    ],
  };
}

export function toResponse(
  content: string,
  model: string,
  prompt: string,
  toolCalls?: Array<{ type: 'function'; function: { name: string; arguments: string } }>,
  reasoning?: string,
): ResultNotStreaming {
  return {
    model,
    created: nowSec(),
    usage: toUsage(prompt, content),
    choices: [
      {
        message: {
          content,
          role: 'assistant',
          tool_calls: toolCalls as any,
          ...(reasoning ? { reasoning } : {}),
        },
        finish_reason: toolCalls ? 'tool_calls' : 'stop',
        index: 0,
      },
    ],
  };
}
