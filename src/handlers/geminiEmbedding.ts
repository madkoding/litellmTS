import { GoogleGenerativeAI } from '@google/generative-ai';

import { EmbeddingParams, EmbeddingResponse } from '../types';

export async function GeminiEmbeddingHandler(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const apiKey = params.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini requires an API key. Set GEMINI_API_KEY environment variable or pass apiKey in params.');
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

import { registerEmbeddingHandler } from '../registry';
registerEmbeddingHandler('gemini/', GeminiEmbeddingHandler);
