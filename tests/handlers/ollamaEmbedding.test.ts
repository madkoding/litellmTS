import { OllamaEmbeddingHandler } from '../../src/handlers/ollamaEmbedding';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OllamaEmbeddingHandler batch (C5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns one embedding per input preserving order and index', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.1, 0.2] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.3, 0.4] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.5, 0.6] }) } as unknown as Response);

    const result = await OllamaEmbeddingHandler({
      model: 'ollama/all-MiniLM',
      input: ['hola', 'mundo', '!'
      ],
    });

    expect(result.data).toHaveLength(3);
    expect(result.data.map((d) => d.index)).toEqual([0, 1, 2]);
    expect(result.data.map((d) => d.embedding)).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
      [0.5, 0.6],
    ]);
  });

  it('handles single string input as one-element batch', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.9] }) } as unknown as Response);

    const result = await OllamaEmbeddingHandler({
      model: 'ollama/all-MiniLM',
      input: 'lonely',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ embedding: [0.9], index: 0 });
  });
});