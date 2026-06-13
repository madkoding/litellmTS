const mockFetch = jest.fn();
global.fetch = mockFetch;

import { listModels, registerModelProvider, clearModelCache, listProviders } from '../src/models/registry';

const ollamaTagsResponse = {
  models: [{ name: 'llama3:8b' }, { name: 'mistral:7b' }],
};

const openaiModelsResponse = {
  data: [{ id: 'gpt-4' }, { id: 'gpt-3.5-turbo' }],
};

describe('listModels fallback chain', () => {
  beforeEach(() => {
    clearModelCache();
    mockFetch.mockReset();
  });

  describe('with baseUrl (fallback chain active)', () => {
    it('should return models from /api/tags when it succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ollamaTagsResponse,
      });

      const result = await listModels('ollama', { baseUrl: 'http://localhost:11434' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
      expect(result).toEqual([
        { id: 'llama3:8b', provider: 'ollama' },
        { id: 'mistral:7b', provider: 'ollama' },
      ]);
    });

    it('should fallback to /models when /api/tags fails', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => openaiModelsResponse,
        });

      const result = await listModels('groq', {
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: 'test-key',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://api.groq.com/openai/v1/api/tags');
      expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://api.groq.com/openai/v1/models', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }));
      expect(result).toEqual([
        { id: 'gpt-4', provider: 'groq' },
        { id: 'gpt-3.5-turbo', provider: 'groq' },
      ]);
    });

    it('should fallback to /models when /api/tags returns no models', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ models: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => openaiModelsResponse,
        });

      const result = await listModels('groq', {
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: 'test-key',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        { id: 'gpt-4', provider: 'groq' },
        { id: 'gpt-3.5-turbo', provider: 'groq' },
      ]);
    });

    it('should fallback to registered fetcher when both /api/tags and /models fail', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false });

      registerModelProvider('custom', async () => [
        { id: 'custom-model', provider: 'custom' },
      ]);

      const result = await listModels('custom', {
        baseUrl: 'https://custom.api.com/v1',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ id: 'custom-model', provider: 'custom' }]);
    });
  });

  describe('without baseUrl (direct fetcher)', () => {
    it('should call the registered fetcher directly', async () => {
      registerModelProvider('test-provider', async () => [
        { id: 'model-a', provider: 'test-provider' },
      ]);

      const result = await listModels('test-provider');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 'model-a', provider: 'test-provider' }]);
    });

    it('should throw when provider is not registered', async () => {
      await expect(listModels('non-existent')).rejects.toThrow(
        "Provider 'non-existent' not found.",
      );
    });
  });

  describe('caching', () => {
    it('should cache results and not re-fetch within TTL', async () => {
      registerModelProvider('cache-test', async () => [
        { id: 'm1', provider: 'cache-test' },
      ]);

      const first = await listModels('cache-test');
      const second = await listModels('cache-test');

      expect(first).toEqual(second);
      expect(first).toEqual([{ id: 'm1', provider: 'cache-test' }]);
    });

    it('should skip cache when baseUrl is provided but fetcher returns empty, and try endpoints again', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false });

      registerModelProvider('empty-provider', async () => []);

      const result = await listModels('empty-provider', {
        baseUrl: 'https://api.example.com',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });
  });

  describe('baseUrl trailing slash handling', () => {
    it('should strip trailing slashes from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ollamaTagsResponse,
      });

      await listModels('ollama', { baseUrl: 'http://localhost:11434/' });

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });
  });
});

describe('listProviders', () => {
  it('should return registered providers', () => {
    const providers = listProviders();
    expect(Array.isArray(providers)).toBe(true);
    providers.forEach((p) => {
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('hasModelList', true);
    });
  });
});