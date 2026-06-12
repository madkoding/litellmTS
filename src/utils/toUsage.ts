import { EmbeddingResponse } from '../types';
import { ConsistentResponseUsage } from '../types';
import { getEncoder } from './encoders';

/**
 * Count the number of tokens in a text string using cl100k_base encoding.
 */
export function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

/**
 * Build a usage object from prompt and completion text.
 * Returns `undefined` when there is no completion text.
 */
export function toUsage(
  prompt: string,
  completion: string | undefined,
): ConsistentResponseUsage | undefined {
  if (!completion) {
    return undefined;
  }

  const promptTokens = countTokens(prompt);
  const completionTokens = countTokens(completion);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

export function toEmbeddingUsage(prompt: string): EmbeddingResponse['usage'] {
  const promptTokens = getEncoder().encode(prompt);
  return {
    prompt_tokens: promptTokens.length,
    total_tokens: promptTokens.length,
  };
}
