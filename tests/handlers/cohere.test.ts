const mockChat = jest.fn();
const mockChatStream = jest.fn();
jest.mock('cohere-ai', () => ({
  Cohere: {},
  CohereClient: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    chatStream: mockChatStream,
  })),
}));

import { CohereHandler } from '../../src/handlers/cohere';

const mockChatResponse = {
  text: 'Hello from Cohere',
  finishReason: 'COMPLETE',
  meta: { tokens: { inputTokens: 10, outputTokens: 5 } },
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
      mockChat.mockResolvedValueOnce(mockChatResponse);

      const result = await CohereHandler({
        model: 'command',
        messages: [{ role: 'user', content: 'hello' }],
        stream: false,
      });

      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'command',
          message: 'hello',
          maxTokens: 50,
        }),
      );

      expect(result).toMatchObject({
        model: 'command',
        choices: [
          {
            message: { content: 'Hello from Cohere', role: 'assistant' },
            finish_reason: 'stop',
            index: 0,
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });
    });
  });

  describe('streaming', () => {
    it('yields chunks from real stream', async () => {
      process.env.COHERE_API_KEY = 'test-key';

      async function* fakeStream(): AsyncGenerator {
        yield { eventType: 'text-generation', text: 'Hello ' };
        yield { eventType: 'text-generation', text: 'World!' };
        yield { eventType: 'stream-end', finishReason: 'COMPLETE', response: { text: 'Hello World!' } };
      }
      mockChatStream.mockResolvedValueOnce(fakeStream());

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
