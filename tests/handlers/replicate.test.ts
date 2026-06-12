const mockPredictionsCreate = jest.fn();
const mockWait = jest.fn();

jest.mock('eventsource', () => {
  return jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
  }));
});

jest.mock('replicate', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      predictions: { create: mockPredictionsCreate },
      wait: mockWait,
    })),
  };
});

import { ReplicateHandler } from '../../src/handlers/replicate';

describe('ReplicateHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REPLICATE_API_KEY;
  });

  describe('non-streaming', () => {
    it('returns formatted result from prediction', async () => {
      process.env.REPLICATE_API_KEY = 'test-key';
      const mockPrediction = { id: 'pred-1', urls: {} as Record<string, unknown> | undefined };
      const mockOutput = { output: ['Hello ', 'world'] };

      mockPredictionsCreate.mockResolvedValueOnce(mockPrediction);
      mockWait.mockResolvedValueOnce(mockOutput);

      const result = await ReplicateHandler({
        model: 'replicate/model:abc123',
        messages: [{ role: 'user', content: 'test' }],
        stream: false,
      });

      expect(result).toMatchObject({
        choices: [{ message: { content: 'Hello world', role: 'assistant' } }],
      });
    });
  });
});
