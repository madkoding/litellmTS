import { GoogleGenAI } from '@google/genai';

import type { EmbeddingParams, EmbeddingResponse } from '../types';

export async function GeminiEmbeddingHandler(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const apiKey = params.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini requires an API key. Set GEMINI_API_KEY environment variable or pass apiKey in params.');
  const modelName = params.model.startsWith('gemini/')
    ? params.model.slice(7)
    : params.model;

  const client = new GoogleGenAI({ apiKey });

  const input = typeof params.input === 'string'
    ? params.input
    : params.input.join(' ');

  const result = await client.models.embedContent({
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: input }] }],
  });

  return {
    model: modelName,
    data: [{ embedding: result.embeddings?.[0]?.values ?? [], index: 0 }],
  };
}

import { registerEmbeddingHandler } from '../registry';
registerEmbeddingHandler('gemini/', GeminiEmbeddingHandler);
