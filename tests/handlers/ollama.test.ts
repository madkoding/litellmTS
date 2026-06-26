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
  const parsed = JSON.parse(text);
  return { ok, body: bodyStream, status: ok ? 200 : 500, json: async () => parsed } as unknown as Response;
}

function createStreamingMockResponse(text: string, ok = true): Response {
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
    it('returns formatted result from single JSON response', async () => {
      const responseBody = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hello World!' }, done: true });

      mockFetch.mockResolvedValueOnce(createMockResponse(responseBody));

      const result = await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'test' }],
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({
          body: expect.stringContaining('"messages":[{"role":"user","content":"test"}]'),
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

      mockFetch.mockResolvedValueOnce(createStreamingMockResponse(responseChunks));

      const result = await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({
          body: expect.stringContaining('"messages":[{"role":"user","content":"test"}]'),
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

  describe('url resolution', () => {
    beforeEach(() => {
      delete process.env.OLLAMA_API_KEY;
    });

    it('uses localhost:11434 by default when no apiKey', async () => {
      const responseBody = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hello' }, done: true });
      mockFetch.mockResolvedValueOnce(createMockResponse(responseBody));

      await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe('http://localhost:11434/api/chat');
    });

    it('uses https://ollama.com when apiKey is provided without baseUrl', async () => {
      const responseBody = JSON.stringify({
        id: 'cmpl-xxx',
        object: 'chat.completion',
        created: 1000,
        model: 'gpt-oss:120b-cloud',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      });
      mockFetch.mockResolvedValueOnce(createMockResponse(JSON.stringify(responseBody)));

      await OllamaHandler({
        model: 'ollama/gpt-oss:120b',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        apiKey: 'ollama-key-123',
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe('https://ollama.com/v1/chat/completions');
    });

    it('uses https://ollama.com when OLLAMA_API_KEY env is set', async () => {
      process.env.OLLAMA_API_KEY = 'env-key-456';
      const responseBody = JSON.stringify({
        id: 'cmpl-xxx',
        object: 'chat.completion',
        created: 1000,
        model: 'gpt-oss:120b-cloud',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      });
      mockFetch.mockResolvedValueOnce(createMockResponse(JSON.stringify(responseBody)));

      await OllamaHandler({
        model: 'ollama/gpt-oss:120b',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe('https://ollama.com/v1/chat/completions');
      const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
      expect(authHeader).toBe('Bearer env-key-456');
    });

    it('strips /api suffix from baseUrl to avoid duplication', async () => {
      const responseBody = JSON.stringify({
        id: 'cmpl-xxx',
        object: 'chat.completion',
        created: 1000,
        model: 'llama2-cloud',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      });
      mockFetch.mockResolvedValueOnce(createMockResponse(JSON.stringify(responseBody)));

      await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        baseUrl: 'https://ollama.com/api',
        apiKey: 'k',
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe('https://ollama.com/v1/chat/completions');
    });

    it('strips trailing slash from baseUrl', async () => {
      const responseBody = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hello' }, done: true });
      mockFetch.mockResolvedValueOnce(createMockResponse(responseBody));

      await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        baseUrl: 'http://localhost:11434/',
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe('http://localhost:11434/api/chat');
    });
  });

  describe('sampling params', () => {
    it('defaults repeat_penalty, top_k, top_p when not provided (native endpoint)', async () => {
      const responseBody = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hi' }, done: true });
      mockFetch.mockResolvedValueOnce(createMockResponse(responseBody));

      await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.options.repeat_penalty).toBe(1.1);
      expect(body.options.top_k).toBe(40);
      expect(body.options.top_p).toBe(0.9);
    });

    it('passes custom repetition_penalty, top_k, top_p to native endpoint', async () => {
      const responseBody = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hi' }, done: true });
      mockFetch.mockResolvedValueOnce(createMockResponse(responseBody));

      await OllamaHandler({
        model: 'ollama/llama2',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        repetition_penalty: 1.2,
        top_k: 50,
        top_p: 0.95,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.options.repeat_penalty).toBe(1.2);
      expect(body.options.top_k).toBe(50);
      expect(body.options.top_p).toBe(0.95);
    });

    it('passes repetition_penalty and frequency_penalty to OpenAI endpoint', async () => {
      const responseBody = JSON.stringify({
        id: 'cmpl-xxx',
        object: 'chat.completion',
        created: 1000,
        model: 'gpt-oss:120b-cloud',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
      });
      mockFetch.mockResolvedValueOnce(createMockResponse(JSON.stringify(responseBody)));

      await OllamaHandler({
        model: 'ollama/gpt-oss:120b',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        apiKey: 'ollama-key-123',
        repetition_penalty: 1.05,
        frequency_penalty: 0.2,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.repetition_penalty).toBe(1.05);
      expect(body.frequency_penalty).toBe(0.2);
    });

    it('does not send repetition params for OpenAI endpoint when not provided', async () => {
      const responseBody = JSON.stringify({
        id: 'cmpl-xxx',
        object: 'chat.completion',
        created: 1000,
        model: 'gpt-oss:120b-cloud',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
      });
      mockFetch.mockResolvedValueOnce(createMockResponse(JSON.stringify(responseBody)));

      await OllamaHandler({
        model: 'ollama/gpt-oss:120b',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        apiKey: 'ollama-key-123',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.repetition_penalty).toBeUndefined();
      expect(body.frequency_penalty).toBeUndefined();
    });
  });

  describe('auth headers', () => {
    beforeEach(() => {
      delete process.env.OLLAMA_API_KEY;
    });

    it('sends Authorization header when apiKey is provided', async () => {
      const responseBody = JSON.stringify({
        id: 'cmpl-xxx',
        object: 'chat.completion',
        created: 1000,
        model: 'gpt-oss:120b-cloud',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      });

      mockFetch.mockResolvedValueOnce(createMockResponse(JSON.stringify(responseBody)));

      await OllamaHandler({
        model: 'ollama/gpt-oss:120b',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        apiKey: 'ollama-key-123',
        baseUrl: 'https://ollama.com',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://ollama.com/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ollama-key-123',
          }),
        }),
      );
    });

    it('does not send Authorization header when no apiKey', async () => {
      const responseBody = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hello' }, done: true });

      mockFetch.mockResolvedValueOnce(createMockResponse(responseBody));

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
