import { OpenAIEmbeddingHandler } from './openaiEmbedding';
import type { EmbeddingParams, EmbeddingResponse } from '../types';
import type { OpenAILikeConfig } from '../mappings/openaiLike';

export function createOpenAILikeEmbeddingHandler(
  prefix: string, config: OpenAILikeConfig,
): (params: EmbeddingParams) => Promise<EmbeddingResponse> {
  return async (params: EmbeddingParams): Promise<EmbeddingResponse> => {
    const apiKey = params.apiKey ?? process.env[config.apiKeyEnv];
    if (!apiKey) {
      throw new Error(
        `${config.name} requires an API key. Set the ${config.apiKeyEnv} environment variable or pass apiKey in params.`,
      );
    }
    const modelName = params.model.startsWith(prefix)
      ? params.model.slice(prefix.length)
      : params.model;
    return OpenAIEmbeddingHandler({
      ...params,
      model: modelName,
      apiKey,
      baseUrl: config.baseUrl,
    });
  };
}

import { OPENAI_LIKE_MAPPINGS } from '../mappings/openaiLike';
import { registerEmbeddingHandler } from '../registry';
for (const [prefix, config] of Object.entries(OPENAI_LIKE_MAPPINGS)) {
  registerEmbeddingHandler(prefix, createOpenAILikeEmbeddingHandler(prefix, config));
}
