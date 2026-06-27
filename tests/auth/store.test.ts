const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();
const mockChmod = jest.fn();
const mockRename = jest.fn();

jest.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  chmod: mockChmod,
  rename: mockRename,
}));

import {
  getProviderCredentials,
  setProviderCredentials,
  getCopilotCredentials,
  setCopilotCredentials,
  clearCredentials,
  decrypt,
} from '../../src/auth/store';

function enoent(): Error {
  return Object.assign(new Error('file not found'), { code: 'ENOENT' });
}

describe('auth/store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRename.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  describe('getProviderCredentials', () => {
    it('returns null when file does not exist', async () => {
      mockReadFile.mockRejectedValueOnce(enoent());
      const result = await getProviderCredentials('test-provider');
      expect(result).toBeNull();
    });

    it('returns null when provider key not in store', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ other: { key: 'val' } }));
      const result = await getProviderCredentials('test-provider');
      expect(result).toBeNull();
    });

    it('returns credentials for existing provider', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ 'github-copilot': { token: 'abc' } }));
      const result = await getProviderCredentials<{ token: string }>('github-copilot');
      expect(result).toEqual({ token: 'abc' });
    });
  });

  describe('setProviderCredentials', () => {
    it('creates new file and writes credentials', async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockReadFile.mockRejectedValueOnce(enoent());

      await setProviderCredentials('test-provider', { key: 'val' });

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('auth.json'),
        expect.any(String),
        'utf-8',
      );
      const written = mockWriteFile.mock.calls[0][1];
      expect(JSON.parse(decrypt(written))).toEqual({ 'test-provider': { key: 'val' }, __version: 1 });
    });

    it('merges with existing store', async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ existing: { x: 1 } }));

      await setProviderCredentials('new-provider', { y: 2 });

      const writeCall = mockWriteFile.mock.calls[0][1];
      expect(JSON.parse(decrypt(writeCall))).toEqual({
        existing: { x: 1 },
        'new-provider': { y: 2 },
        __version: 1,
      });
    });
  });

  describe('getCopilotCredentials', () => {
    it('returns null when no credentials', async () => {
      mockReadFile.mockRejectedValueOnce(enoent());
      const result = await getCopilotCredentials();
      expect(result).toBeNull();
    });

    it('returns migrated legacy credentials', async () => {
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({})) // getProviderCredentials reads empty store
        .mockResolvedValueOnce(JSON.stringify({ copilotToken: 'ct', githubToken: 'gt', expiresAt: 100 })) // readStore for legacy migration
        .mockResolvedValueOnce(JSON.stringify({})); // setProviderCredentials reads before write
      mockMkdir.mockResolvedValueOnce(undefined); // setProviderCredentials ensureDir

      const result = await getCopilotCredentials();
      expect(result).toEqual({ githubToken: 'gt', copilotToken: 'ct', expiresAt: 100, enterpriseUrl: undefined });
    });
  });

  describe('setCopilotCredentials', () => {
    it('stores under github-copilot key', async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockReadFile.mockRejectedValueOnce(enoent());

      const creds = { githubToken: 'gt', copilotToken: 'ct', expiresAt: 999, enterpriseUrl: 'https://example.com' };
      await setCopilotCredentials(creds);

      const writeCall = JSON.parse(decrypt(mockWriteFile.mock.calls[0][1]));
      expect(writeCall['github-copilot']).toEqual(creds);
    });
  });

  describe('clearCredentials', () => {
    it('writes empty store', async () => {
      await clearCredentials();
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('auth.json'),
        expect.any(String),
        'utf-8',
      );
      const written = mockWriteFile.mock.calls[0][1];
      expect(JSON.parse(decrypt(written))).toEqual({ __version: 1 });
    });
  });
});
