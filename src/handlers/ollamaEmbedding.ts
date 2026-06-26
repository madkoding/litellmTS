import { EmbeddingParams, EmbeddingResponse } from '../types';
import { toEmbeddingUsage } from '../utils/toUsage';
import { stripPrefix } from '../utils/stripPrefix';

interface OllamaEmbeddingsResponseChunk {
  embedding: number[];
}

async function getOllamaResponse(
  model: string,
  input: string,
  baseUrl: string,
): Promise<Response> {
  return fetch(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: input,
      stream: false,
    }),
  });
}

export async function OllamaEmbeddingHandler(
  params: EmbeddingParams,
): Promise<EmbeddingResponse> {
  const model = stripPrefix(params.model, 'ollama/');
  const baseUrl = params.baseUrl ?? 'http://127.0.0.1:11434';
  const input =
    typeof params.input === 'string'
      ? params.input
      : params.input.reduce((acc, curr) => acc + curr, '');
  const response = await getOllamaResponse(model, input, baseUrl);

  if (!response.ok) {
    throw new Error(
      `Received an error with code ${response.status} from Ollama API.`,
    );
  }
  const body = (await response.json()) as OllamaEmbeddingsResponseChunk;

  return {
    data: [{ embedding: body.embedding, index: 0 }],
    model: model,
    usage: toEmbeddingUsage(input),
  };
}

import { registerEmbeddingHandler } from '../registry';
registerEmbeddingHandler('ollama/', OllamaEmbeddingHandler);