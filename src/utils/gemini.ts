import type { GenerateContentResponse } from '@google/genai';

import type {
  Message,
  FinishReason,
  ConsistentResponseUsage,
  ResultNotStreaming,
  ResultStreaming,
  StreamingChunk,
} from '../types';
import { getUnixTimestamp } from './getUnixTimestamp';

export function toGeminiContent(messages: Message[]): { role: string; parts: { text: string }[] }[] {
  return messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: msg.content ? [{ text: msg.content }] : [],
  }));
}

export function toFinishReason(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    default:
      return 'stop';
  }
}

export function toUsage(
  meta: GenerateContentResponse['usageMetadata'],
): ConsistentResponseUsage | undefined {
  if (!meta) return undefined;
  return {
    prompt_tokens: meta.promptTokenCount ?? 0,
    completion_tokens: meta.candidatesTokenCount ?? 0,
    total_tokens: meta.totalTokenCount ?? 0,
  };
}

export function toResponse(
  response: GenerateContentResponse,
  model: string,
): ResultNotStreaming {
  const candidate = response.candidates?.[0];
  return {
    model,
    created: getUnixTimestamp(),
    usage: toUsage(response.usageMetadata),
    choices: [
      {
        index: candidate?.index ?? 0,
        finish_reason: toFinishReason(candidate?.finishReason),
        message: {
          role: 'assistant',
          content: candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? null,
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
    const deltaContent = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const chunkOutput: StreamingChunk = {
      model,
      created: getUnixTimestamp(),
      usage: toUsage(chunk.usageMetadata),
      choices: [
        {
          index: candidate?.index ?? 0,
          finish_reason: toFinishReason(candidate?.finishReason),
          delta: {
            content: deltaContent,
            role: 'assistant',
          },
        },
      ],
    };
    yield chunkOutput;
  }
}
