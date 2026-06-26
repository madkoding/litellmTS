import OpenAI from 'openai';
import { EmbeddingParams, EmbeddingResponse } from '../types';
import { stripPrefix } from '../utils/stripPrefix';
import { wrapApiError } from '../utils/wrapApiError';

export async function OpenAIEmbeddingHandler(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = params.baseUrl;
  const modelName = stripPrefix(params.model, 'openai/');

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });
  try {
    return await openai.embeddings.create({ input: params.input, model: modelName });
  } catch (err) {
    throw wrapApiError('OpenAI embedding', err);
  }
}

import { registerEmbeddingHandler } from '../registry';
registerEmbeddingHandler('openai/', OpenAIEmbeddingHandler);
