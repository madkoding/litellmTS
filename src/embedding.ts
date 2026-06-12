import { CompletionUsage } from 'openai/resources';
import { getHandler } from './handlers/getHandler';
import { EmbeddingHandler } from './types';
import { OpenAIEmbeddingHandler } from './handlers/openaiEmbedding';
import { OllamaEmbeddingHandler } from './handlers/ollamaEmbedding';
import { MistralEmbeddingHandler } from './handlers/mistralEmbedding';
import { GeminiEmbeddingHandler } from './handlers/geminiEmbedding';
import { OPENAI_LIKE_MAPPINGS } from './mappings/openaiLike';
import { createOpenAILikeEmbeddingHandler } from './handlers/openaiLikeEmbedding';

export interface EmbeddingParams {
  input: string | string[];
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface EmbeddingObject {
  embedding: number[];
  index: number;
}

export interface EmbeddingResponse {
  usage?: Pick<CompletionUsage, 'prompt_tokens' | 'total_tokens'>;
  model: string;
  data: EmbeddingObject[];
}

const OPENAI_LIKE_EMBEDDING_HANDLERS: Record<string, EmbeddingHandler> = {};
for (const [prefix, config] of Object.entries(OPENAI_LIKE_MAPPINGS)) {
  OPENAI_LIKE_EMBEDDING_HANDLERS[prefix] =
    createOpenAILikeEmbeddingHandler(config);
}

const EMBEDDING_MODEL_HANDLER_MAPPINGS: Record<string, EmbeddingHandler> = {
  ...OPENAI_LIKE_EMBEDDING_HANDLERS,
  'text-embedding-': OpenAIEmbeddingHandler,
  'ollama/': OllamaEmbeddingHandler,
  'mistral/': MistralEmbeddingHandler,
  'gemini/': GeminiEmbeddingHandler,
};

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
