import { OpenAIEmbeddingHandler } from './openaiEmbedding';
import type { EmbeddingParams, EmbeddingResponse } from '../embedding';
import type { OpenAILikeConfig } from '../mappings/openaiLike';

export function createOpenAILikeEmbeddingHandler(
  config: OpenAILikeConfig,
): (params: EmbeddingParams) => Promise<EmbeddingResponse> {
  return async (params: EmbeddingParams): Promise<EmbeddingResponse> => {
    const apiKey = params.apiKey ?? process.env[config.apiKeyEnv];
    if (!apiKey) {
      throw new Error(
        `${config.name} requires an API key. Set the ${config.apiKeyEnv} environment variable or pass apiKey in params.`,
      );
    }
    return OpenAIEmbeddingHandler({
      ...params,
      apiKey,
      baseUrl: config.baseUrl,
    });
  };
}
