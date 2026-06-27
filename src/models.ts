export interface ModelInfo {
  id: string;
  provider: string;
  created?: number;
}

export interface ProviderInfo {
  name: string;
}

type ModelFetcher = (params?: { apiKey?: string; baseUrl?: string }) => Promise<ModelInfo[]>;

import { fetchWithTimeout } from './utils/fetchWithTimeout';

const fetchers = new Map<string, ModelFetcher>();
const cache = new Map<string, { data: ModelInfo[]; expires: number }>();
const inFlight = new Map<string, Promise<ModelInfo[]>>();
const CACHE_TTL = 5 * 60 * 1000;

export function registerModelProvider(provider: string, fetcher: ModelFetcher): void {
  fetchers.set(provider, fetcher);
}

interface TagsModel {
  name: string;
}

interface OpenAIModel {
  id: string;
}

async function tryOllamaTags(baseUrl: string, provider: string, apiKey?: string): Promise<ModelInfo[] | null> {
  try {
    const key = apiKey ?? process.env.OLLAMA_API_KEY;
    const headers: Record<string, string> = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const url = baseUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    const res = await fetchWithTimeout(`${url}/api/tags`, { headers });
    if (!res.ok) return null;
    const { models } = (await res.json()) as { models: TagsModel[] };
    if (!Array.isArray(models)) return null;
    return models.map((m) => ({ id: m.name.replace(/-cloud$/, ''), provider }));
  } catch {
    return null;
  }
}

async function tryOpenAIModels(baseUrl: string, provider: string, apiKey?: string): Promise<ModelInfo[] | null> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetchWithTimeout(`${baseUrl}/models`, { headers });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: OpenAIModel[] };
    if (!Array.isArray(data)) return null;
    return data.map((m) => ({ id: m.id, provider }));
  } catch {
    return null;
  }
}

export async function listModels(
  provider: string,
  opts?: { apiKey?: string; baseUrl?: string },
): Promise<ModelInfo[]> {
  const cached = cache.get(provider);
  if (cached && cached.expires > Date.now()) return cached.data;

  const existing = inFlight.get(provider);
  if (existing) return existing;

  const promise = (async () => {
    let data: ModelInfo[] | null = null;
    try {
      if (opts?.baseUrl) {
        const baseUrl = opts.baseUrl.replace(/\/+$/, '');
        data = await tryOllamaTags(baseUrl, provider, opts.apiKey);
        if (!data || data.length === 0) {
          data = await tryOpenAIModels(baseUrl, provider, opts.apiKey);
        }
      }
      if (!data || data.length === 0) {
        const fetcher = fetchers.get(provider);
        if (!fetcher) throw new Error(`Provider '${provider}' not found.`);
        data = await fetcher(opts);
      }
      cache.set(provider, { data, expires: Date.now() + CACHE_TTL });
      return data;
    } finally {
      inFlight.delete(provider);
    }
  })();
  inFlight.set(provider, promise);
  return promise;
}

export function listProviders(): ProviderInfo[] {
  return Array.from(fetchers.keys()).map((key) => ({
    name: key,
  }));
}

export function clearModelCache(): void {
  cache.clear();
}
