import { OllamaHandler } from '../../src/handlers/ollama';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function createMockResponse(text: string, ok = true): Response {
  const encoder = new TextEncoder();
  const bodyStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return { ok, body: bodyStream, status: ok ? 200 : 500 } as unknown as Response;
}

describe('OllamaHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('non-streaming', () => {
    it('returns formatted result from streamed chunks', async () => {
      const responseChunks = [
        JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hello ' }, done: false }),
        JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'World!' }, done: true }),
      ].join('\n');

      mockFetch.mockResolvedValueOnce(createMockResponse(responseChunks));

      const result = await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'test' }],
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({
          body: expect.stringContaining('"messages":[{"role":"user","content":"Human: test"}]'),
        }),
      );

      expect(result).toMatchObject({
        model: 'llama2',
        choices: [{ message: { content: 'Hello World!', role: 'assistant' } }],
      });
    });
  });

  describe('streaming', () => {
    it('yields chunks incrementally', async () => {
      const responseChunks = [
        JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hello ' }, done: false }),
        JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'World!' }, done: true }),
      ].join('\n');

      mockFetch.mockResolvedValueOnce(createMockResponse(responseChunks));

      const result = await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({
          body: expect.stringContaining('"messages":[{"role":"user","content":"Human: test"}]'),
        }),
      );

      const chunks: unknown[] = [];
      for await (const chunk of result as AsyncIterable<unknown>) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({ choices: [{ delta: { content: 'Hello ' } }] });
      expect(chunks[1]).toMatchObject({ choices: [{ delta: { content: 'World!' } }] });
    });
  });

  describe('cloud', () => {
    it('sends Authorization header when apiKey is provided', async () => {
      const responseChunks = [
        JSON.stringify({ model: 'gpt-oss:120b', created_at: '', message: { role: 'assistant', content: 'Hello' }, done: true }),
      ].join('\n');

      mockFetch.mockResolvedValueOnce(createMockResponse(responseChunks));

      await OllamaHandler({
        model: 'ollama/gpt-oss:120b',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        apiKey: 'ollama-key-123',
        baseUrl: 'https://ollama.com',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://ollama.com/api/chat',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ollama-key-123',
          }),
        }),
      );
    });

    it('does not send Authorization header when no apiKey', async () => {
      const responseChunks = [
        JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hello' }, done: true }),
      ].join('\n');

      mockFetch.mockResolvedValueOnce(createMockResponse(responseChunks));

      await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.Authorization).toBeUndefined();
    });
  });
});
