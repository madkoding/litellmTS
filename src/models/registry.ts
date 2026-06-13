import type { ModelInfo, ProviderInfo } from './types';

type ModelFetcher = (params?: { apiKey?: string; baseUrl?: string }) => Promise<ModelInfo[]>;

const fetchers = new Map<string, ModelFetcher>();
const cache = new Map<string, { data: ModelInfo[]; expires: number }>();
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

async function tryOllamaTags(baseUrl: string, provider: string): Promise<ModelInfo[] | null> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) return null;
    const { models } = (await res.json()) as { models: TagsModel[] };
    if (!Array.isArray(models)) return null;
    return models.map((m) => ({ id: m.name, provider }));
  } catch {
    return null;
  }
}

async function tryOpenAIModels(baseUrl: string, provider: string, apiKey?: string): Promise<ModelInfo[] | null> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${baseUrl}/models`, { headers });
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

  let data: ModelInfo[] | null = null;

  if (opts?.baseUrl) {
    const baseUrl = opts.baseUrl.replace(/\/+$/, '');

    data = await tryOllamaTags(baseUrl, provider);
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
}

export function listProviders(): ProviderInfo[] {
  return Array.from(fetchers.keys()).map((key) => ({
    name: key,
    hasModelList: true,
  }));
}

export function clearModelCache(): void {
  cache.clear();
}
