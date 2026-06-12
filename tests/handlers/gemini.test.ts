const mockGenerateContent = jest.fn();
const mockGenerateContentStream = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
    },
  })),
}));

import { GeminiHandler } from '../../src/handlers/gemini';

function createMockResponse(text: string) {
  return {
    candidates: [
      {
        index: 0,
        finishReason: 'STOP',
        content: { parts: [{ text }] },
      },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
  };
}

describe('GeminiHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  it('throws if no API key', async () => {
    await expect(
      GeminiHandler({ model: 'gemini/gemini-pro', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('Gemini requires an API key');
  });

  describe('non-streaming', () => {
    it('returns formatted result', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValueOnce(createMockResponse('Hello from Gemini'));

      const result = await GeminiHandler({
        model: 'gemini/gemini-pro',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

      expect(result).toMatchObject({
        choices: [{
          message: { content: 'Hello from Gemini', role: 'assistant' },
          finish_reason: 'stop',
        }],
      });
    });
  });

  describe('streaming', () => {
    it('yields chunks from stream', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      async function* mockStream(): AsyncGenerator {
        yield createMockResponse('Hello ');
        yield createMockResponse('World!');
      }

      mockGenerateContentStream.mockResolvedValue(mockStream());

      const result = await GeminiHandler({
        model: 'gemini/gemini-pro',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      });

      const chunks: unknown[] = [];
      for await (const chunk of result as AsyncIterable<unknown>) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({ choices: [{ delta: { content: 'Hello ' } }] });
      expect(chunks[1]).toMatchObject({ choices: [{ delta: { content: 'World!' } }] });
    });
  });
});
