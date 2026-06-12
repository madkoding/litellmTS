import OpenAI from 'openai';
import { EmbeddingParams, EmbeddingResponse } from '../types';

export async function OpenAIEmbeddingHandler(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = params.baseUrl;

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });
  try {
    return await openai.embeddings.create({ input: params.input, model: params.model });
  } catch (err) {
    throw new Error(`OpenAI embedding API error: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
}

import { registerEmbeddingHandler } from '../registry';
registerEmbeddingHandler('text-embedding-', OpenAIEmbeddingHandler);
