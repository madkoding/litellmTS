import OpenAI from 'openai';
import { EmbeddingParams, EmbeddingResponse } from '../embedding';

export async function OpenAIEmbeddingHandler(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = params.baseUrl;

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });
  return openai.embeddings.create({ input: params.input, model: params.model });
}
