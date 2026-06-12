import type { ModelInfo, ProviderInfo } from './types';

type ModelFetcher = (params?: { apiKey?: string; baseUrl?: string }) => Promise<ModelInfo[]>;

const fetchers = new Map<string, ModelFetcher>();
const cache = new Map<string, { data: ModelInfo[]; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function registerModelProvider(provider: string, fetcher: ModelFetcher): void {
  fetchers.set(provider, fetcher);
}

export async function listModels(
  provider: string,
  opts?: { apiKey?: string; baseUrl?: string },
): Promise<ModelInfo[]> {
  const cached = cache.get(provider);
  if (cached && cached.expires > Date.now()) return cached.data;

  const fetcher = fetchers.get(provider);
  if (!fetcher) throw new Error(`Provider '${provider}' not found.`);

  const data = await fetcher(opts);
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
