const mockEmbeddingsCreate = jest.fn();
const mockOpenAIConstructor = jest.fn();

jest.mock('openai', () => {
  const MockOpenAI = function (...args: unknown[]) {
    mockOpenAIConstructor(...args);
    return {
      embeddings: {
        create: mockEmbeddingsCreate,
      },
    };
  };
  return MockOpenAI;
});

import { embedding } from '../src';
import { OpenAIEmbeddingHandler } from '../src/handlers/openaiEmbedding';

describe('embedding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OpenAIEmbeddingHandler', () => {
    it('should call embeddings.create with correct params', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        model: 'text-embedding-ada-002',
        usage: { prompt_tokens: 3, total_tokens: 3 },
      });

      const result = await OpenAIEmbeddingHandler({
        model: 'text-embedding-ada-002',
        input: 'hello world',
        apiKey: 'test-key',
      });

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        input: 'hello world',
        model: 'text-embedding-ada-002',
      });
      expect(result).toMatchObject({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        model: 'text-embedding-ada-002',
        usage: { prompt_tokens: 3, total_tokens: 3 },
      });
    });

    it('should pass baseUrl to OpenAI constructor', async () => {
      mockEmbeddingsCreate.mockResolvedValue({ data: [] });

      await OpenAIEmbeddingHandler({
        model: 'text-embedding-ada-002',
        input: 'test',
        apiKey: 'key',
        baseUrl: 'https://custom.proxy/v1',
      });

      expect(mockOpenAIConstructor).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'https://custom.proxy/v1' }),
      );
    });

    it('should pass apiKey to OpenAI constructor', async () => {
      mockEmbeddingsCreate.mockResolvedValue({ data: [] });

      await OpenAIEmbeddingHandler({
        model: 'text-embedding-ada-002',
        input: 'test',
        apiKey: 'my-secret-key',
        baseUrl: 'https://custom.proxy/v1',
      });

      expect(mockOpenAIConstructor).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'my-secret-key' }),
      );
    });

    it('should fall back to OPENAI_API_KEY env var', async () => {
      process.env.OPENAI_API_KEY = 'fallback-key';
      mockEmbeddingsCreate.mockResolvedValue({ data: [] });

      await OpenAIEmbeddingHandler({
        model: 'text-embedding-ada-002',
        input: 'test',
      });

      expect(mockOpenAIConstructor).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'fallback-key' }),
      );
      delete process.env.OPENAI_API_KEY;
    });
  });

  describe('embedding() function routing', () => {
    it('should route text-embedding- models to OpenAI', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.5, 0.5], index: 0 }],
        model: 'text-embedding-ada-002',
      });

      const result = await embedding({
        model: 'text-embedding-ada-002',
        input: 'test',
      });

      expect(mockEmbeddingsCreate).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should throw for unsupported models', async () => {
      await expect(
        embedding({ model: 'nonexistent-model', input: 'test' }),
      ).rejects.toThrow('not supported');
    });
  });
});
