import { AI21Handler } from '../../src/handlers/ai21';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const ai21Response = {
  id: 'test-id',
  prompt: { text: 'hi', tokens: [] },
  completions: [
    {
      finishReason: { reason: 'endoftext' },
      data: { text: 'Hello from AI21', tokens: [] },
    },
  ],
};

function mockOkResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

function mockErrorResponse(status: number): Response {
  return { ok: false, status } as Response;
}

describe('AI21Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AI21_API_KEY;
  });

  it('throws if no API key', async () => {
    await expect(
      AI21Handler({ model: 'ai21/j2-ultra', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('AI21 requires an API key');
  });

  describe('non-streaming', () => {
    it('returns formatted result', async () => {
      process.env.AI21_API_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce(mockOkResponse(ai21Response));

      const result = await AI21Handler({
        model: 'ai21/j2-ultra',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/studio/v1/j2-ultra/complete'),
        expect.any(Object),
      );

      expect(result).toMatchObject({
        model: 'j2-ultra',
        choices: [{ message: { content: 'Hello from AI21', role: 'assistant' } }],
      });
    });
  });

  describe('streaming', () => {
    it('returns an async iterable for streaming', async () => {
      process.env.AI21_API_KEY = 'test-key';
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"text":"Hello","finishReason":{"reason":"endoftext"}}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      mockFetch.mockResolvedValueOnce({ ok: true, body: stream } as unknown as Response);

      const result = await AI21Handler({
        model: 'ai21/j2-ultra',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      });

      const chunks: unknown[] = [];
      for await (const chunk of result as AsyncIterable<unknown>) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        choices: [{ delta: { content: 'Hello' } }],
      });
    });
  });

  it('throws on HTTP error', async () => {
    process.env.AI21_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce(mockErrorResponse(400));

    await expect(
      AI21Handler({ model: 'ai21/j2-ultra', messages: [] }),
    ).rejects.toThrow('Received an error with code 400 from AI21 API');
  });
});
