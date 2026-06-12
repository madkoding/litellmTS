jest.mock('../../src/handlers/openaiEmbedding', () => ({
  OpenAIEmbeddingHandler: jest.fn(),
}));

import { OpenAIEmbeddingHandler } from '../../src/handlers/openaiEmbedding';
import { createOpenAILikeEmbeddingHandler } from '../../src/handlers/openaiLikeEmbedding';
import type { OpenAILikeConfig } from '../../src/mappings/openaiLike';

const mockConfig: OpenAILikeConfig = {
  name: 'TestEmbedding',
  baseUrl: 'https://test-embed.ai/v1',
  apiKeyEnv: 'TEST_EMBED_API_KEY',
};
const PREFIX = 'test-embed/';

describe('createOpenAILikeEmbeddingHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TEST_EMBED_API_KEY;
  });

  it('should strip prefix and call OpenAIEmbeddingHandler with baseUrl and apiKey from env var', async () => {
    process.env.TEST_EMBED_API_KEY = 'env-embed-key';
    const handler = createOpenAILikeEmbeddingHandler(PREFIX, mockConfig);

    await handler({ model: 'test-embed/model', input: 'hello world' });

    expect(OpenAIEmbeddingHandler).toHaveBeenCalledTimes(1);
    expect(OpenAIEmbeddingHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'model',
        input: 'hello world',
        baseUrl: 'https://test-embed.ai/v1',
        apiKey: 'env-embed-key',
      }),
    );
  });

  it('should prefer explicit apiKey over env var', async () => {
    process.env.TEST_EMBED_API_KEY = 'wrong-key';
    const handler = createOpenAILikeEmbeddingHandler(PREFIX, mockConfig);

    await handler({
      model: 'test-embed/model',
      input: 'test',
      apiKey: 'correct-key',
    });

    expect(OpenAIEmbeddingHandler).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'correct-key' }),
    );
  });

  it('should throw if no API key is available', async () => {
    const handler = createOpenAILikeEmbeddingHandler(PREFIX, mockConfig);

    await expect(
      handler({ model: 'test-embed/model', input: 'test' }),
    ).rejects.toThrow('TestEmbedding requires an API key');
  });

  it('should pass input array to OpenAIEmbeddingHandler', async () => {
    process.env.TEST_EMBED_API_KEY = 'key';
    const handler = createOpenAILikeEmbeddingHandler(PREFIX, mockConfig);

    await handler({ model: 'test-embed/model', input: ['a', 'b', 'c'] });

    expect(OpenAIEmbeddingHandler).toHaveBeenCalledWith(
      expect.objectContaining({ input: ['a', 'b', 'c'] }),
    );
  });

  it('should return the result from OpenAIEmbeddingHandler', async () => {
    process.env.TEST_EMBED_API_KEY = 'key';
    const expectedResult = {
      model: 'test-embed-model',
      data: [{ embedding: [0.1, 0.2], index: 0 }],
    };
    (OpenAIEmbeddingHandler as jest.Mock).mockResolvedValueOnce(
      expectedResult,
    );
    const handler = createOpenAILikeEmbeddingHandler(PREFIX, mockConfig);

    const result = await handler({ model: 'test-embed/model', input: 'x' });

    expect(result).toBe(expectedResult);
  });
});
