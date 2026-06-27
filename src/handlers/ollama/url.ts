export const OLLAMA_CLOUD_URL = 'https://ollama.com';
export const OLLAMA_LOCAL_URL = 'http://localhost:11434';

export function resolveOllamaBaseUrl(apiKey?: string, baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/api\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '');
  if (apiKey || process.env.OLLAMA_API_KEY) return OLLAMA_CLOUD_URL;
  return OLLAMA_LOCAL_URL;
}