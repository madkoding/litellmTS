import { OllamaHandler } from '../../src/handlers/ollama';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function chunkedStreamResponse(chunks: Uint8Array[], ok = true): Response {
  const bodyStream = new ReadableStream({
    async start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  return { ok, body: bodyStream, status: ok ? 200 : 500 } as unknown as Response;
}

const enc = (s: string) => new TextEncoder().encode(s);

describe('Ollama streaming buffer carryover (C3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OLLAMA_API_KEY;
  });

  it('reassembles a JSON line split across chunk boundaries', async () => {
    const fullLine = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'Hello' }, done: false });
    const cut = Math.floor(fullLine.length / 2);
    const part1 = fullLine.slice(0, cut);
    const part2 = fullLine.slice(cut);

    mockFetch.mockResolvedValueOnce(
      chunkedStreamResponse([enc(part1), enc(part2 + '\n')]),
    );

    const result = await OllamaHandler({
      model: 'ollama/llama2',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });

    const chunks: unknown[] = [];
    for await (const chunk of result as AsyncIterable<unknown>) chunks.push(chunk);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ choices: [{ delta: { content: 'Hello' } }] });
  });

  it('parses multiple lines where boundary lands mid-JSON', async () => {
    const line1 = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'A' }, done: false });
    const line2 = JSON.stringify({ model: 'llama2', created_at: '', message: { role: 'assistant', content: 'B' }, done: true });
    const combined = line1 + '\n' + line2 + '\n';
    const cut = Math.floor(combined.length * 0.6);

    mockFetch.mockResolvedValueOnce(
      chunkedStreamResponse([enc(combined.slice(0, cut)), enc(combined.slice(cut))]),
    );

    const result = await OllamaHandler({
      model: 'ollama/llama2',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });

    const chunks: unknown[] = [];
    for await (const chunk of result as AsyncIterable<unknown>) chunks.push(chunk);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ choices: [{ delta: { content: 'A' } }] });
    expect(chunks[1]).toMatchObject({ choices: [{ delta: { content: 'B' } }] });
  });
});