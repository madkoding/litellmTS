import { getHandler } from './handlers/getHandler';
import {
  HandlerParams,
  HandlerParamsNotStreaming,
  HandlerParamsStreaming,
  Result,
  ResultNotStreaming,
  ResultStreaming,
} from './types';
import { completionHandlers } from './registry';

import './handlers';

export const MODEL_HANDLER_MAPPINGS = completionHandlers;

/**
 * Send a chat completion request to the provider that matches the model prefix.
 *
 * Supports 45+ providers including OpenAI, Anthropic, Cohere, Gemini, Groq, Together AI, and more.
 * Model routing is automatic based on the model name prefix (e.g. `gpt-`, `claude-`, `gemini/`).
 *
 * @param params - The completion parameters including model, messages, and optional stream flag
 * @returns The completion result (non-streaming) or an async iterable (streaming)
 *
 * @example
 * // Non-streaming
 * const res = await completion({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] });
 *
 * @example
 * // Streaming
 * const stream = await completion({ model: 'claude-3', messages: [{ role: 'user', content: 'Hi' }], stream: true });
 * for await (const chunk of stream) { process.stdout.write(chunk.choices[0].delta.content ?? ''); }
 */
export async function completion(
  params: HandlerParamsNotStreaming,
): Promise<ResultNotStreaming>;

export async function completion(
  params: HandlerParamsStreaming,
): Promise<ResultStreaming>;

export async function completion(params: HandlerParams): Promise<Result>;

export async function completion(params: HandlerParams): Promise<Result> {
  const handler = getHandler(params.model, MODEL_HANDLER_MAPPINGS);

  if (!handler) {
    throw new Error(
      `Model: ${params.model} not supported. Cannot find a handler.`,
    );
  }

  return handler(params);
}
