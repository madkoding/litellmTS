import { GoogleGenerativeAI } from '@google/generative-ai';

import { EmbeddingParams, EmbeddingResponse } from '../embedding';

export async function GeminiEmbeddingHandler(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const apiKey = params.apiKey ?? process.env.GEMINI_API_KEY!;
  const modelName = params.model.startsWith('gemini/')
    ? params.model.slice(7)
    : params.model;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const input = typeof params.input === 'string'
    ? params.input
    : params.input.join(' ');

  const result = await model.embedContent({
    content: {
      role: 'user',
      parts: [{ text: input }],
    },
  });

  return {
    model: modelName,
    data: [{ embedding: result.embedding.values, index: 0 }],
  };
}
