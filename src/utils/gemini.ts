import type { GenerateContentResponse, Part } from '@google/genai';

import type {
  Message,
  FinishReason,
  ConsistentResponseUsage,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
} from '../types';
import { nowSec } from './nowSec';
import { safeParseArgs } from './safeParseArgs';
import { mergeSystem } from './mergeSystem';


export function toGeminiContent(
  messages: Message[],
): { role: string; parts: Part[] }[] {
  const { messages: msgs } = mergeSystem(messages);
  const result: { role: string; parts: Part[] }[] = [];

  for (const msg of msgs) {
    if (msg.role === 'user') {
      const parts: Part[] = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      result.push({ role: 'user', parts });
      continue;
    }

    if (msg.role === 'assistant') {
      const parts: Part[] = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          const args = safeParseArgs(tc.function.arguments);
          parts.push({
            functionCall: {
              name: tc.function.name,
              args,
            },
          });
        }
      }
      result.push({ role: 'model', parts });
      continue;
    }

    if (msg.role === 'tool') {
      const parts: Part[] = [];
      if (msg.content) {
        parts.push({
          functionResponse: {
            name: 'tool_result',
            response: { result: msg.content },
          },
        });
      }
      result.push({ role: 'user', parts });
      continue;
    }

    if (msg.content) {
      result.push({ role: 'user', parts: [{ text: msg.content }] });
    }
  }

  return result;
}

export function toGeminiTools(
  tools?: {
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }[],
): { functionDeclarations: { name: string; description?: string; parameters?: Record<string, unknown> }[] }[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters ?? { type: 'object', properties: {} },
      })),
    },
  ];
}

export function toGeminiToolConfig(
  toolChoice?: 'none' | 'auto' | { type: 'function'; function: { name: string } },
): { functionCallingConfig: { mode: string; allowedFunctionNames?: string[] } } | undefined {
  if (!toolChoice) return undefined;
  if (toolChoice === 'none') return { functionCallingConfig: { mode: 'NONE' } };
  if (toolChoice === 'auto') return { functionCallingConfig: { mode: 'AUTO' } };
  if (typeof toolChoice === 'object' && 'function' in toolChoice) {
    return {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [toolChoice.function.name],
      },
    };
  }
  return undefined;
}

export function toFinishReason(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'RECITATION':
    case 'SAFETY':
      return 'content_filter';
    case 'FINISH_REASON_UNSPECIFIED':
    default:
      return 'stop';
  }
}

export function toGeminiUsage(
  meta: GenerateContentResponse['usageMetadata'],
): ConsistentResponseUsage | undefined {
  if (!meta) return undefined;
  return {
    prompt_tokens: meta.promptTokenCount ?? 0,
    completion_tokens: meta.candidatesTokenCount ?? 0,
    total_tokens: meta.totalTokenCount ?? 0,
  };
}

function getFunctionCallsFromParts(
  parts: Part[],
): { id: string; type: 'function'; function: { name: string; arguments: string } }[] | undefined {
  const functionCalls = parts.filter((p): p is Part & { functionCall: NonNullable<Part['functionCall']> } => !!p.functionCall);
  if (functionCalls.length === 0) return undefined;
  return functionCalls.map((p, i) => ({
    id: `fc_${i}`,
    type: 'function' as const,
    function: {
      name: p.functionCall.name ?? '',
      arguments: JSON.stringify(p.functionCall.args ?? {}),
    },
  }));
}

export function toResponse(
  response: GenerateContentResponse,
  model: string,
): ResultNotStreaming {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p) => (p as Part & { text?: string }).text ?? '').join('');
  const toolCalls = getFunctionCallsFromParts(parts);
  const finishReason = candidate?.finishReason
    ? toFinishReason(candidate.finishReason)
    : toolCalls
      ? 'tool_calls'
      : 'stop';

  return {
    model,
    created: nowSec(),
    usage: toGeminiUsage(response.usageMetadata),
    choices: [
      {
        index: candidate?.index ?? 0,
        finish_reason: finishReason,
        message: {
          role: 'assistant',
          content: text || null,
          ...(toolCalls ? { tool_calls: toolCalls } : {}),
        },
      },
    ],
  };
}

export async function* toStreamingResponse(
  stream: AsyncGenerator<GenerateContentResponse>,
  model: string,
): ResultStreaming {
  for await (const chunk of stream) {
    const candidate = chunk.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const deltaContent = parts.map((p) => (p as Part & { text?: string }).text ?? '').join('');
    const toolCalls = getFunctionCallsFromParts(parts);
    const finishReason = candidate?.finishReason
      ? toFinishReason(candidate.finishReason)
      : null;

    const chunkOutput: StreamingChunk = {
      model,
      created: nowSec(),
      usage: toGeminiUsage(chunk.usageMetadata),
      choices: [
        {
          index: candidate?.index ?? 0,
          finish_reason: finishReason,
          delta: {
            content: deltaContent || undefined,
            role: 'assistant',
            ...(toolCalls
              ? { tool_calls: toolCalls }
              : {}),
          },
        },
      ],
    };
    yield chunkOutput;
  }
}
