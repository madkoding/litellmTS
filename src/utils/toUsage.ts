import { getEncoding } from 'js-tiktoken';
import { EmbeddingResponse } from '../types';
import { ConsistentResponseUsage } from '../types';

let _encoder: ReturnType<typeof getEncoding> | null = null;
function encoder(): ReturnType<typeof getEncoding> {
  _encoder ??= getEncoding('cl100k_base');
  return _encoder;
}

export function toUsage(
  prompt: string,
  completion: string | undefined,
): ConsistentResponseUsage | undefined {
  if (!completion) return undefined;
  const t = (s: string) => encoder().encode(s).length;
  const promptTokens = t(prompt);
  const completionTokens = t(completion);
  return { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens };
}

export function toEmbeddingUsage(prompt: string): EmbeddingResponse['usage'] {
  const promptTokens = encoder().encode(prompt);
  return { prompt_tokens: promptTokens.length, total_tokens: promptTokens.length };
}
