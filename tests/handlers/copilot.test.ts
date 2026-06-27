const mockGetValidToken = jest.fn();
jest.mock('../../src/auth', () => ({
  getValidToken: mockGetValidToken,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { CopilotHandler } from '../../src/handlers/copilot';

function mockJsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
    status: ok ? 200 : 401,
    statusText: ok ? 'OK' : 'Unauthorized',
  } as Response;
}

describe('CopilotHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.COPILOT_API_KEY;
  });

  it('throws if no API key available', async () => {
    mockGetValidToken.mockResolvedValueOnce(null);

    await expect(
      CopilotHandler({ model: 'copilot/gpt-4', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('No Copilot token found');
  });

  describe('non-streaming', () => {
    it('returns formatted result', async () => {
      process.env.COPILOT_API_KEY = 'test-key';
      const apiResponse = {
        id: 'chatcmpl-1',
        model: 'gpt-4',
        created: 1234567890,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'Hello from Copilot' },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      mockFetch.mockResolvedValueOnce(mockJsonResponse(apiResponse));

      const result = await CopilotHandler({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

      expect(result).toMatchObject({
        model: 'gpt-4',
        choices: [{ message: { content: 'Hello from Copilot' } }],
      });
    });
  });

  it('strips copilot/ prefix from model', async () => {
    process.env.COPILOT_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      id: '1', model: 'gpt-4', created: 0,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
    }));

    await CopilotHandler({
      model: 'copilot/gpt-4',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as Record<string, unknown>).body as string);
    expect(body.model).toBe('gpt-4');
    expect(body.model).not.toBe('copilot/gpt-4');
  });

  it('throws on HTTP error', async () => {
    process.env.COPILOT_API_KEY = 'bad-key';
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: 'unauthorized' }, false));

    await expect(
      CopilotHandler({ model: 'gpt-4', messages: [] }),
    ).rejects.toThrow('Copilot API error: 401');
  });
});
