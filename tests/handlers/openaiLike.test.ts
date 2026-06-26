jest.mock('../../src/handlers/openai', () => ({
  OpenAIHandler: jest.fn(),
}));

import { OpenAIHandler } from '../../src/handlers/openai';
import { createOpenAILikeHandler } from '../../src/handlers/openaiLike';
import { OPENAI_LIKE_MAPPINGS } from '../../src/mappings/openaiLike';
import type { OpenAILikeConfig } from '../../src/mappings/openaiLike';

const mockConfig: OpenAILikeConfig = {
  name: 'TestProvider',
  baseUrl: 'https://test-provider.ai/v1',
  apiKeyEnv: 'TEST_PROVIDER_API_KEY',
};
const PREFIX = 'test/';

describe('createOpenAILikeHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TEST_PROVIDER_API_KEY;
  });

  it('should strip prefix and call OpenAIHandler with baseUrl and apiKey from env var', async () => {
    process.env.TEST_PROVIDER_API_KEY = 'env-key-123';
    const handler = createOpenAILikeHandler(PREFIX, mockConfig);

    await handler({
      model: 'test/model-v1',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(OpenAIHandler).toHaveBeenCalledTimes(1);
    expect(OpenAIHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'model-v1',
        baseUrl: 'https://test-provider.ai/v1',
        apiKey: 'env-key-123',
      }),
    );
  });

  it('should prefer explicit apiKey over env var', async () => {
    process.env.TEST_PROVIDER_API_KEY = 'wrong-key';
    const handler = createOpenAILikeHandler(PREFIX, mockConfig);

    await handler({
      model: 'test/model',
      messages: [],
      apiKey: 'explicit-key',
    });

    expect(OpenAIHandler).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'explicit-key' }),
    );
  });

  it('should throw if no API key is available', async () => {
    const handler = createOpenAILikeHandler(PREFIX, mockConfig);

    await expect(
      handler({ model: 'test/model', messages: [] }),
    ).rejects.toThrow('TestProvider requires an API key');
  });

  it('should pass streaming param to OpenAIHandler', async () => {
    process.env.TEST_PROVIDER_API_KEY = 'key';
    const handler = createOpenAILikeHandler(PREFIX, mockConfig);

    await handler({
      model: 'test/model',
      messages: [],
      stream: true,
    });

    expect(OpenAIHandler).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
    );
  });

  it('should pass all extra params to OpenAIHandler', async () => {
    process.env.TEST_PROVIDER_API_KEY = 'key';
    const handler = createOpenAILikeHandler(PREFIX, mockConfig);

    await handler({
      model: 'test/model',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      max_tokens: 100,
      top_p: 0.9,
    });

    expect(OpenAIHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'model',
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.9,
      }),
    );
  });

  it('should return the result from OpenAIHandler', async () => {
    process.env.TEST_PROVIDER_API_KEY = 'key';
    const expectedResult = {
      model: 'test/model',
      choices: [
        {
          finish_reason: 'stop',
          index: 0,
          message: { role: 'assistant', content: 'response' },
        },
      ],
    };
    (OpenAIHandler as jest.Mock).mockResolvedValueOnce(expectedResult);
    const handler = createOpenAILikeHandler(PREFIX, mockConfig);

    const result = await handler({
      model: 'test/model',
      messages: [],
    });

    expect(result).toBe(expectedResult);
  });
});

describe('OPENAI_LIKE_MAPPINGS integrity', () => {
  it('every provider config has all required fields', () => {
    const entries: [string, OpenAILikeConfig][] =
      Object.entries(OPENAI_LIKE_MAPPINGS);
    for (const [prefix, config] of entries) {
      expect(prefix).toMatch(/^[\w-]+\/$/);
      expect(typeof config.name).toBe('string');
      expect(config.baseUrl).toMatch(/^https?:\/\//);
      expect(config.apiKeyEnv).toMatch(/^[A-Z0-9_]+$/);
    }
  });
});
