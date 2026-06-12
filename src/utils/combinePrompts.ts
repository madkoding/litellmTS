import { Message } from '../types';

/**
 * Combine an array of chat messages into a single prompt string with role labels.
 *
 * Used by providers with legacy string-based prompt APIs (Cohere, AI21, Replicate, Ollama).
 *
 * @param messages - The messages to combine
 * @returns A single prompt string with format `"Human: ...\n\nAssistant: ..."`
 */
export function combinePrompts(messages: Message[]): string {
  return messages
    .map((msg) => {
      const roleLabel = msg.role === 'assistant' ? 'Assistant' : msg.role === 'system' ? 'System' : 'Human';
      return `${roleLabel}: ${msg.content ?? ''}`;
    })
    .join('\n\n');
}
