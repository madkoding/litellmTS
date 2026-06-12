const mockGenerate = jest.fn();
const mockGenerateStream = jest.fn();
jest.mock('cohere-ai', () => ({
  CohereClient: jest.fn().mockImplementation(() => ({
    generate: mockGenerate,
    generateStream: mockGenerateStream,
  })),
}));

import { CohereHandler } from '../../src/handlers/cohere';

const mockGeneration = {
  generations: [{ text: 'Hello from Cohere' }],
};

describe('CohereHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.COHERE_API_KEY;
  });

  it('throws if no API key', async () => {
    await expect(
      CohereHandler({ model: 'command', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('Cohere requires an API key');
  });

  describe('non-streaming', () => {
    it('returns formatted result', async () => {
      process.env.COHERE_API_KEY = 'test-key';
      mockGenerate.mockResolvedValueOnce(mockGeneration);

      const result = await CohereHandler({
        model: 'command',
        messages: [{ role: 'user', content: 'hello' }],
        stream: false,
      });

      expect(result).toMatchObject({
        model: 'command',
        choices: [
          {
            message: { content: 'Hello from Cohere', role: 'assistant' },
            finish_reason: 'stop',
            index: 0,
          },
        ],
      });
    });
  });

  describe('streaming', () => {
    it('yields chunks from real stream', async () => {
      process.env.COHERE_API_KEY = 'test-key';

      async function* fakeStream(): AsyncGenerator {
        yield { eventType: 'text-generation', text: 'Hello ', isFinished: false, index: 0 };
        yield { eventType: 'text-generation', text: 'World!', isFinished: false, index: 0 };
        yield { eventType: 'stream-end', isFinished: true, finishReason: 'COMPLETE', response: {} };
      }
      mockGenerateStream.mockResolvedValueOnce(fakeStream());

      const result = await CohereHandler({
        model: 'command',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      });

      const chunks: unknown[] = [];
      for await (const chunk of result as AsyncIterable<unknown>) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toMatchObject({ choices: [{ delta: { content: 'Hello ' } }] });
      expect(chunks[1]).toMatchObject({ choices: [{ delta: { content: 'World!' } }] });
      expect(chunks[2]).toMatchObject({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }] });
    });
  });
});
