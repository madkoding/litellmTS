import { OpenAIHandler } from './openai';
import type { Handler, HandlerParams, Result } from '../types';
import type { OpenAILikeConfig } from '../mappings/openaiLike';

export function createOpenAILikeHandler(config: OpenAILikeConfig): Handler {
  return async (params: HandlerParams): Promise<Result> => {
    const apiKey = params.apiKey ?? process.env[config.apiKeyEnv];
    if (!apiKey) {
      throw new Error(
        `${config.name} requires an API key. Set the ${config.apiKeyEnv} environment variable or pass apiKey in params.`,
      );
    }
    return OpenAIHandler({
      ...params,
      apiKey,
      baseUrl: config.baseUrl,
    });
  };
}

import { OPENAI_LIKE_MAPPINGS } from '../mappings/openaiLike';
import { registerCompletionHandler } from '../registry';
for (const [prefix, config] of Object.entries(OPENAI_LIKE_MAPPINGS)) {
  registerCompletionHandler(prefix, createOpenAILikeHandler(config));
}
