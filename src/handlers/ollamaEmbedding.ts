import { EmbeddingParams, EmbeddingResponse } from '../types';
import { toEmbeddingUsage } from '../utils/toUsage';
import { stripPrefix } from '../utils/stripPrefix';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface OllamaEmbeddingsResponseChunk {
  embedding: number[];
}

async function getOllamaEmbedding(
  model: string,
  input: string,
  baseUrl: string,
): Promise<number[]> {
  const response = await fetchWithTimeout(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: input, stream: false }),
  });
  if (!response.ok) {
    throw new Error(`Received an error with code ${response.status} from Ollama API.`);
  }
  const body = (await response.json()) as OllamaEmbeddingsResponseChunk;
  return body.embedding;
}

export async function OllamaEmbeddingHandler(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const model = stripPrefix(params.model, 'ollama/');
  const baseUrl = params.baseUrl ?? 'http://127.0.0.1:11434';
  const inputs = typeof params.input === 'string' ? [params.input] : params.input;
  const embeddings = await Promise.all(
    inputs.map((input, index) =>
      getOllamaEmbedding(model, input, baseUrl).then((embedding) => ({ embedding, index })),
    ),
  );
  const allInput = inputs.join('');
  return {
    data: embeddings,
    model,
    usage: toEmbeddingUsage(allInput),
  };
}

import { registerEmbeddingHandler } from '../registry';
registerEmbeddingHandler('ollama/', OllamaEmbeddingHandler);