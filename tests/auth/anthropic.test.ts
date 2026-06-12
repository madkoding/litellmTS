jest.mock('../../src/auth/store', () => ({
  setAnthropicCredentials: jest.fn(),
}));

jest.mock('node:readline/promises', () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn().mockResolvedValue('sk-ant-valid-key'),
    close: jest.fn(),
  }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { loginAnthropic } from '../../src/auth/anthropic';
import { setAnthropicCredentials } from '../../src/auth/store';

describe('auth/anthropic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates and stores a valid key', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await loginAnthropic();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'sk-ant-valid-key' }),
      }),
    );
    expect(setAnthropicCredentials).toHaveBeenCalledWith({ apiKey: 'sk-ant-valid-key' });
  });

  it('throws when validation fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'invalid key',
    } as Response);

    await expect(loginAnthropic()).rejects.toThrow('Key inválida');
  });
});
