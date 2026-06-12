const mockEmbeddingsCreate = jest.fn();
const mockOpenAIConstructor = jest.fn();
const mockGeminiEmbedContent = jest.fn();

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

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { embedContent: mockGeminiEmbedContent },
  })),
}));

import { embedding } from '../src';
import { OpenAIEmbeddingHandler } from '../src/handlers/openaiEmbedding';
import { GeminiEmbeddingHandler } from '../src/handlers/geminiEmbedding';

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
        model: 'openai/text-embedding-ada-002',
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
        model: 'openai/text-embedding-ada-002',
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
        model: 'openai/text-embedding-ada-002',
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
        model: 'openai/text-embedding-ada-002',
        input: 'test',
      });

      expect(mockOpenAIConstructor).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'fallback-key' }),
      );
      delete process.env.OPENAI_API_KEY;
    });
  });

  describe('embedding() function routing', () => {
    it('should route openai/ models to OpenAI', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.5, 0.5], index: 0 }],
        model: 'text-embedding-ada-002',
      });

      const result = await embedding({
        model: 'openai/text-embedding-ada-002',
        input: 'test',
      });

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'text-embedding-ada-002' }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('should throw for unsupported models', async () => {
      await expect(
        embedding({ model: 'nonexistent-model', input: 'test' }),
      ).rejects.toThrow('not supported');
    });
  });

  describe('GeminiEmbeddingHandler', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      delete process.env.GEMINI_API_KEY;
    });

    it('should call embedContent with correct params', async () => {
      mockGeminiEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: [0.1, 0.2] }],
      });

      const result = await GeminiEmbeddingHandler({
        model: 'gemini/text-embedding-004',
        input: 'hello world',
        apiKey: 'test-key',
      });

      expect(mockGeminiEmbedContent).toHaveBeenCalledWith({
        model: 'text-embedding-004',
        contents: [{ role: 'user', parts: [{ text: 'hello world' }] }],
      });
      expect(result).toMatchObject({
        data: [{ embedding: [0.1, 0.2], index: 0 }],
        model: 'text-embedding-004',
      });
    });

    it('should throw if no API key', async () => {
      await expect(
        GeminiEmbeddingHandler({ model: 'gemini/text-embedding-004', input: 'test' }),
      ).rejects.toThrow('Gemini requires an API key');
    });
  });

});
