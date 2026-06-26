import { getHandler } from './handlers/getHandler';
import { EmbeddingParams, EmbeddingResponse } from './types';
import { embeddingHandlers } from './registry';
import './handlers';

const EMBEDDING_MODEL_HANDLER_MAPPINGS = embeddingHandlers;

/**
 * Generate embeddings for the given input using the provider that matches the model prefix.
 *
 * Supports OpenAI, Mistral, Gemini, Ollama, and 38+ OpenAI-compatible embedding providers.
 *
 * @param params - The embedding parameters including input text and model name
 * @returns An embedding response with the vector data
 *
 * @example
 * const res = await embedding({ model: 'text-embedding-3-small', input: 'Hello world' });
 * console.log(res.data[0].embedding);
 */
export async function embedding(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const handler = getHandler(params.model, EMBEDDING_MODEL_HANDLER_MAPPINGS);

  if (!handler) {
    throw new Error(
      `Model: ${params.model} not supported. Cannot find a handler.`,
    );
  }

  return handler(params);
}
