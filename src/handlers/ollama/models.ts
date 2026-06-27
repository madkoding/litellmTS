import { resolveOllamaBaseUrl } from './url';

interface OllamaTag {
  name: string;
}

type ModelFetcherType = (params?: { apiKey?: string; baseUrl?: string }) => Promise<{ id: string; provider: string }[]>;

export function makeOllamaModelProvider(provider: string): ModelFetcherType {
  return async ({ baseUrl, apiKey } = {}) => {
    const url = resolveOllamaBaseUrl(apiKey, baseUrl);
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    else if (process.env.OLLAMA_API_KEY) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
    const res = await fetch(`${url}/api/tags`, { headers });
    if (!res.ok) return [];
    const { models } = (await res.json()) as { models: OllamaTag[] };
    return (models ?? []).map((m) => ({ id: m.name.replace(/-cloud$/, ''), provider }));
  };
}
