const mockEnsureProxyRunning = jest.fn();
const mockReadRateLimit = jest.fn();
const mockLoadTokens = jest.fn();

jest.mock('../proxy/ensureProxyRunning', () => ({
  ensureProxyRunning: mockEnsureProxyRunning,
}));

jest.mock('../proxy/RateLimitCache', () => ({
  PROXY_PORT: 8787,
  readRateLimit: mockReadRateLimit,
}));

jest.mock('../proxy/TokenListLoader', () => ({
  loadTokens: mockLoadTokens,
}));

import { ProxyClaudeTokenUsageRepository } from './ProxyClaudeTokenUsageRepository';

describe('ProxyClaudeTokenUsageRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureObservable', () => {
    it('should start the proxy on the default port', async () => {
      mockEnsureProxyRunning.mockResolvedValue(undefined);
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      await repository.ensureObservable();

      expect(mockEnsureProxyRunning.mock.calls).toEqual([[8787]]);
    });

    it('should start the proxy on the configured port', async () => {
      mockEnsureProxyRunning.mockResolvedValue(undefined);
      const repository = new ProxyClaudeTokenUsageRepository(
        '/tokens.json',
        9999,
      );

      await repository.ensureObservable();

      expect(mockEnsureProxyRunning.mock.calls).toEqual([[9999]]);
    });
  });

  describe('getAvailableTokenUsages', () => {
    it('should return an empty list when no token path is configured', async () => {
      const repository = new ProxyClaudeTokenUsageRepository(null);

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([]);
      expect(mockLoadTokens.mock.calls).toHaveLength(0);
    });

    it('should return an empty list when the token list cannot be loaded', async () => {
      mockLoadTokens.mockReturnValue(null);
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([]);
      expect(mockLoadTokens.mock.calls).toEqual([['/tokens.json']]);
    });

    it('should map each token to its cached utilization', async () => {
      mockLoadTokens.mockReturnValue(['token-a', 'token-b']);
      mockReadRateLimit.mockImplementation((token: string) => {
        if (token === 'token-a') {
          return {
            fiveHourUtilization: 42,
            fiveHourReset: 0,
            sevenDayUtilization: 0,
            sevenDayReset: 0,
            blocked: false,
            rejected: false,
          };
        }
        return null;
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 42,
          blocked: false,
          rejected: false,
        },
        {
          token: 'token-b',
          fiveHourUtilization: 0,
          blocked: false,
          rejected: false,
        },
      ]);
    });

    it('should propagate the blocked status from the cache', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 5,
        fiveHourReset: 0,
        sevenDayUtilization: 0,
        sevenDayReset: 0,
        blocked: true,
        rejected: false,
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 5,
          blocked: true,
          rejected: false,
        },
      ]);
    });

    it('should propagate the rejected status from the cache', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 100,
        fiveHourReset: 0,
        sevenDayUtilization: 0,
        sevenDayReset: 0,
        blocked: false,
        rejected: true,
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 100,
          blocked: false,
          rejected: true,
        },
      ]);
    });

    it('should default rejected to false when no snapshot exists', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue(null);
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 0,
          blocked: false,
          rejected: false,
        },
      ]);
    });
  });

  describe('proxyBaseUrl', () => {
    it('should build the loopback url for the default port', () => {
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      expect(repository.proxyBaseUrl()).toBe('http://127.0.0.1:8787');
    });

    it('should build the loopback url for the configured port', () => {
      const repository = new ProxyClaudeTokenUsageRepository(
        '/tokens.json',
        9999,
      );

      expect(repository.proxyBaseUrl()).toBe('http://127.0.0.1:9999');
    });
  });
});
