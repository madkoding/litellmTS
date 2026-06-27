const mockPredictionsCreate = jest.fn();

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: Record<string, ((e: { data?: string }) => void)[]> = {};
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: { data?: string }) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  close() { this.closed = true; }
  emit(type: string, data?: string) {
    for (const fn of this.listeners[type] ?? []) fn({ data });
  }
  emitDone() {
    for (const fn of this.listeners['done'] ?? []) fn({});
  }
}

jest.mock('replicate', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    predictions: { create: mockPredictionsCreate },
  })),
}));

import { ReplicateHandler } from '../../src/handlers/replicate';

async function tick() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('ReplicateHandler streaming (C6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockEventSource.instances.length = 0;
    (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
    process.env.REPLICATE_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete (globalThis as unknown as { EventSource?: unknown }).EventSource;
    delete process.env.REPLICATE_API_KEY;
  });

  it('emits incremental deltas, not cumulative', async () => {
    const mockPrediction = { id: 'pred-1', urls: { stream: 'https://stream.test/p1' } };
    mockPredictionsCreate.mockResolvedValueOnce(mockPrediction);

    const result = (await ReplicateHandler({
      model: 'replicate/owner/model:abc123',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })) as AsyncIterable<{ delta?: { content?: string } }>;

    const it = result[Symbol.asyncIterator]();
    const firstNext = it.next();
    await tick();
    const source = MockEventSource.instances[0];
    expect(source).toBeDefined();

    source!.emit('output', 'Hel');
    const r1 = await firstNext;
    expect(r1.value?.choices?.[0]?.delta?.content).toBe('Hel');

    const next2 = it.next();
    source!.emit('output', 'lo');
    const r2 = await next2;
    expect(r2.value?.choices?.[0]?.delta?.content).toBe('lo');

    const next3 = it.next();
    source!.emit('output', '!');
    const r3 = await next3;
    expect(r3.value?.choices?.[0]?.delta?.content).toBe('!');

    const finalNext = it.next();
    source!.emitDone();
    await finalNext;
    await it.return?.();
  });

  it('uses cumulative content for usage accounting but emits incremental delta', async () => {
    const mockPrediction = { id: 'pred-2', urls: { stream: 'https://stream.test/p2' } };
    mockPredictionsCreate.mockResolvedValueOnce(mockPrediction);

    const result = (await ReplicateHandler({
      model: 'replicate/owner/model:abc123',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })) as AsyncIterable<{ delta?: { content?: string }; usage?: { prompt_tokens: number; completion_tokens: number } }>;

    const it = result[Symbol.asyncIterator]();
    const firstNext = it.next();
    await tick();
    const source = MockEventSource.instances[0];

    source!.emit('output', 'AB');
    const r1 = await firstNext;

    const next2 = it.next();
    source!.emit('output', 'CD');
    const r2 = await next2;

    const finalNext = it.next();
    source!.emitDone();
    await finalNext;
    await it.return?.();

    expect(r1.value?.choices?.[0]?.delta?.content).toBe('AB');
    expect(r2.value?.choices?.[0]?.delta?.content).toBe('CD');
    const c1 = r1.value?.usage?.completion_tokens ?? 0;
    const c2 = r2.value?.usage?.completion_tokens ?? 0;
    expect(c2).toBeGreaterThanOrEqual(c1);
  });
});