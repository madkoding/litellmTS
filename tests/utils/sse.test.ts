import { iterateSSEStream } from '../../src/utils/sse';

function createMockResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return { body: stream, ok: true } as Response;
}

describe('iterateSSEStream', () => {
  it('yields parsed chunks from data lines', async () => {
    const response = createMockResponse([
      'data: {"text":"hello"}\ndata: {"text":"world"}\n',
    ]);
    const results: unknown[] = [];
    for await (const chunk of iterateSSEStream(response, (payload) => JSON.parse(payload))) {
      results.push(chunk);
    }
    expect(results).toEqual([{ text: 'hello' }, { text: 'world' }]);
  });

  it('stops on [DONE] token', async () => {
    const response = createMockResponse([
      'data: {"text":"hello"}\ndata: [DONE]\ndata: {"text":"ignored"}\n',
    ]);
    const results: unknown[] = [];
    for await (const chunk of iterateSSEStream(response, (payload) => JSON.parse(payload))) {
      results.push(chunk);
    }
    expect(results).toEqual([{ text: 'hello' }]);
  });

  it('skips non-data lines', async () => {
    const response = createMockResponse([
      'event: custom\ndata: {"ok":true}\n:comment\n',
    ]);
    const results: unknown[] = [];
    for await (const chunk of iterateSSEStream(response, (payload) => JSON.parse(payload))) {
      results.push(chunk);
    }
    expect(results).toEqual([{ ok: true }]);
  });

  it('uses custom doneToken', async () => {
    const response = createMockResponse([
      'data: {"x":1}\ndata: [END]\n',
    ]);
    const results: unknown[] = [];
    for await (const chunk of iterateSSEStream(response, (payload) => JSON.parse(payload), '[END]')) {
      results.push(chunk);
    }
    expect(results).toEqual([{ x: 1 }]);
  });

  it('throws if response has no body', async () => {
    const response = { body: null } as Response;
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iterateSSEStream(response, (p) => p)) {
        // noop
      }
    }).rejects.toThrow('Response body is not readable');
  });
});
