import { fetchWithTimeout } from './fetchWithTimeout';
import type { ModelInfo } from '../models';

export interface OpenAIModelListConfig {
  baseUrl: string;
  apiKeyEnv: string;
  provider: string;
}

export function createOpenAIModelListFetcher(config: OpenAIModelListConfig) {
  return async ({ apiKey }: { apiKey?: string } = {}): Promise<ModelInfo[]> => {
    const key = apiKey ?? process.env[config.apiKeyEnv];
    if (!key) return [];
    try {
      const res = await fetchWithTimeout(`${config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return [];
      const { data } = (await res.json()) as { data?: { id: string; created?: number }[] };
      return (data ?? []).map((m) => ({ id: m.id, provider: config.provider, created: m.created }));
    } catch {
      return [];
    }
  };
}