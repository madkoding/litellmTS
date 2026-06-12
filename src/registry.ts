import { EmbeddingHandler, Handler } from './types';

const completionHandlers: Record<string, Handler> = {};
const embeddingHandlers: Record<string, EmbeddingHandler> = {};

/**
 * Register a completion handler for a model prefix.
 * Handlers self-register when their module is imported.
 */
export function registerCompletionHandler(prefix: string, handler: Handler): void {
  completionHandlers[prefix] = handler;
}

/**
 * Register an embedding handler for a model prefix.
 * Handlers self-register when their module is imported.
 */
export function registerEmbeddingHandler(prefix: string, handler: EmbeddingHandler): void {
  embeddingHandlers[prefix] = handler;
}

/** @internal Get the completion handler registry. */
export function getCompletionHandlers(): Record<string, Handler> {
  return completionHandlers;
}

/** @internal Get the embedding handler registry. */
export function getEmbeddingHandlers(): Record<string, EmbeddingHandler> {
  return embeddingHandlers;
}
