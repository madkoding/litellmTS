jest.mock('../../src/auth/copilot', () => ({
  login: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/auth/anthropic', () => ({
  loginAnthropic: jest.fn().mockResolvedValue(undefined),
}));

import { runCli, findPackageJson } from '../../src/bin/litellm';
import { login } from '../../src/auth/copilot';
import { loginAnthropic } from '../../src/auth/anthropic';

const mockLogin = login as jest.Mock;
const mockLoginAnthropic = loginAnthropic as jest.Mock;

describe('bin/litellm (A6)', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('findPackageJson', () => {
    it('finds package.json walking up from a start dir', () => {
      const pkg = findPackageJson(__dirname);
      expect(pkg).toHaveProperty('version');
      expect(typeof pkg.version).toBe('string');
    });
  });

  describe('runCli dispatch', () => {
    it('prints version on --version', async () => {
      await runCli(['--version']);
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+\.\d+\.\d+/));
    });

    it('prints version on -v', async () => {
      await runCli(['-v']);
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+\.\d+\.\d+/));
    });

    it('invokes login() copilot on "login copilot"', async () => {
      await runCli(['login', 'copilot']);
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('invokes loginAnthropic() on "login anthropic"', async () => {
      await runCli(['login', 'anthropic']);
      expect(mockLoginAnthropic).toHaveBeenCalledTimes(1);
    });

    it('prints help on unknown command', async () => {
      await runCli(['unknown']);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('litellmTS v'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Uso:'));
    });

    it('prints help with no args', async () => {
      await runCli([]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('litellmTS v'));
    });
  });
});