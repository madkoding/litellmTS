jest.mock('../../src/auth/store', () => ({
  getCopilotCredentials: jest.fn(),
  setCopilotCredentials: jest.fn(),
  getProviderCredentials: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../src/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

import { getCopilotCredentials, setCopilotCredentials } from '../../src/auth/store';
import { fetchWithTimeout } from '../../src/utils/fetchWithTimeout';
import { getValidToken, exchangeCopilotToken } from '../../src/auth/refresh';

const mockedGet = getCopilotCredentials as jest.Mock;
const mockedSet = setCopilotCredentials as jest.Mock;
const mockedFetch = fetchWithTimeout as jest.Mock;

function mockOk(json: unknown) {
  return { ok: true, json: async () => json, status: 200, statusText: 'OK' } as unknown as Response;
}

describe('getValidToken single-flight (C4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSet.mockResolvedValue(undefined);
  });

  it('does not refresh when token is still valid (>5min to expiry)', async () => {
    mockedGet.mockResolvedValueOnce({
      githubToken: 'gh', copilotToken: 'tok', expiresAt: Date.now() + 60 * 60 * 1000,
    });
    const token = await getValidToken();
    expect(token).toBe('tok');
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('returns null when no credentials', async () => {
    mockedGet.mockResolvedValueOnce(null);
    expect(await getValidToken()).toBeNull();
  });

  it('refreshes once when token near expiry', async () => {
    mockedGet.mockResolvedValueOnce({
      githubToken: 'gh', copilotToken: 'old', expiresAt: Date.now() + 60_000,
    });
    mockedFetch.mockResolvedValueOnce(mockOk({ token: 'new', expires_at: Math.floor(Date.now() / 1000) + 3600 }));
    const token = await getValidToken();
    expect(token).toBe('new');
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('single-flight: concurrent calls near expiry trigger exactly one exchange', async () => {
    mockedGet.mockResolvedValue({
      githubToken: 'gh', copilotToken: 'old', expiresAt: Date.now() + 60_000,
    });
    let resolveExchange!: (v: Response) => void;
    mockedFetch.mockReturnValueOnce(new Promise<Response>((r) => (resolveExchange = r)));

    const p1 = getValidToken();
    const p2 = getValidToken();
    const p3 = getValidToken();

    resolveExchange(mockOk({ token: 'shared', expires_at: Math.floor(Date.now() / 1000) + 3600 }));

    const [a, b, c] = await Promise.all([p1, p2, p3]);
    expect(a).toBe('shared');
    expect(b).toBe('shared');
    expect(c).toBe('shared');
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledTimes(1);
  });
});

describe('exchangeCopilotToken retries on transient errors (M7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue(null);
  });

  it('retries on 5xx then succeeds', async () => {
    mockedFetch
      .mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' } as unknown as Response)
      .mockResolvedValueOnce(mockOk({ token: 'ok', expires_at: 9999 }));

    const res = await exchangeCopilotToken('gh');
    expect(res.token).toBe('ok');
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 4xx (non-429)', async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' } as unknown as Response);
    await expect(exchangeCopilotToken('gh')).rejects.toThrow(/Failed to refresh Copilot token/);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});