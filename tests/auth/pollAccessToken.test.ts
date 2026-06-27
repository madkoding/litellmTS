jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('node:child_process', () => ({
  execFileSync: jest.fn(),
}));
jest.mock('../../src/auth/store', () => ({
  setCopilotCredentials: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/auth/refresh', () => ({
  exchangeCopilotToken: jest.fn(),
}));

import { setTimeout as mockedSetTimeout } from 'node:timers/promises';
import { pollAccessToken } from '../../src/auth/copilot';

const mockSleep = mockedSetTimeout as unknown as jest.Mock;

function mockTokenResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
    status: 200,
    statusText: 'OK',
  } as unknown as Response;
}

describe('pollAccessToken (A5)', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSleep.mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns the access_token when first poll succeeds', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce(
      mockTokenResponse({ access_token: 'ghs_token' }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const token = await pollAccessToken('device-code', 5);
    expect(token).toBe('ghs_token');
    expect(mockSleep).toHaveBeenCalledTimes(1);
  });

  it('continues polling on authorization_pending', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(mockTokenResponse({ error: 'authorization_pending' }))
      .mockResolvedValueOnce(mockTokenResponse({ error: 'authorization_pending' }))
      .mockResolvedValueOnce(mockTokenResponse({ access_token: 'late' }));
    global.fetch = mockFetch as unknown as typeof fetch;

    const token = await pollAccessToken('dc', 5);
    expect(token).toBe('late');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('increases interval on slow_down', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(mockTokenResponse({ error: 'slow_down' }))
      .mockResolvedValueOnce(mockTokenResponse({ access_token: 'ok' }));
    global.fetch = mockFetch as unknown as typeof fetch;

    await pollAccessToken('dc', 5);
    expect(mockSleep).toHaveBeenNthCalledWith(1, 5000);
    expect(mockSleep).toHaveBeenNthCalledWith(2, 10000);
  });

  it('throws on expired_token', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce(
      mockTokenResponse({ error: 'expired_token', error_description: 'expired' }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(pollAccessToken('dc', 5)).rejects.toThrow('expired');
  });

  it('throws on access_denied', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce(
      mockTokenResponse({ error: 'access_denied', error_description: 'denied' }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(pollAccessToken('dc', 5)).rejects.toThrow('denied');
  });

  it('throws on non-ok HTTP status', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response);
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(pollAccessToken('dc', 5)).rejects.toThrow(/Polling error: 500/);
  });

  it('times out after 120 attempts', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      mockTokenResponse({ error: 'authorization_pending' }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(pollAccessToken('dc', 1)).rejects.toThrow('Authentication timed out');
    expect(mockFetch).toHaveBeenCalledTimes(120);
  });
});