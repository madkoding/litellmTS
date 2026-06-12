import { OpenAIHandler } from './openai';
import type { Handler, HandlerParams, Result } from '../types';
import type { OpenAILikeConfig } from '../mappings/openaiLike';
import { registerModelProvider } from '../models/registry';

export function createOpenAILikeHandler(prefix: string, config: OpenAILikeConfig): Handler {
  return async (params: HandlerParams): Promise<Result> => {
    const apiKey = params.apiKey ?? process.env[config.apiKeyEnv];
    if (!apiKey) {
      throw new Error(
        `${config.name} requires an API key. Set the ${config.apiKeyEnv} environment variable or pass apiKey in params.`,
      );
    }
    const modelName = params.model.startsWith(prefix)
      ? params.model.slice(prefix.length)
      : params.model;
    return OpenAIHandler({
      ...params,
      model: modelName,
      apiKey,
      baseUrl: config.baseUrl,
    });
  };
}

import { OPENAI_LIKE_MAPPINGS } from '../mappings/openaiLike';
import { registerCompletionHandler } from '../registry';
for (const [prefix, config] of Object.entries(OPENAI_LIKE_MAPPINGS)) {
  registerCompletionHandler(prefix, createOpenAILikeHandler(prefix, config));

  const provider = prefix.replace('/', '');
  registerModelProvider(provider, async ({ apiKey } = {}) => {
    const key = apiKey ?? process.env[config.apiKeyEnv];
    if (!key) return [];
    try {
      const res = await fetch(`${config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return [];
      const { data } = await res.json();
      return (data ?? []).map((m: any) => ({ id: m.id, provider }));
    } catch {
      return [];
    }
  });
}
