const mockSetCopilot = jest.fn();
jest.mock('../../src/auth/store', () => ({
  setCopilotCredentials: mockSetCopilot,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { login } from '../../src/auth/copilot';

describe('auth/copilot - login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws if device code request fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 } as Response);

    await expect(login()).rejects.toThrow('Error al solicitar device code: 429');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
