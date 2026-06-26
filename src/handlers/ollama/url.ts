export function resolveOllamaBaseUrl(apiKey?: string, baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/api\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '');
  if (apiKey || process.env.OLLAMA_API_KEY) return 'https://ollama.com';
  return 'http://localhost:11434';
}
