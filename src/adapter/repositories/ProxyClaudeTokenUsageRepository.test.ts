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

    const futureReset = Math.floor(Date.now() / 1000) + 3600;
    const pastReset = Math.floor(Date.now() / 1000) - 3600;

    it('should map each token to its cached utilization', async () => {
      mockLoadTokens.mockReturnValue(['token-a', 'token-b']);
      mockReadRateLimit.mockImplementation((token: string) => {
        if (token === 'token-a') {
          return {
            fiveHourUtilization: 42,
            fiveHourReset: futureReset,
            sevenDayUtilization: 0,
            sevenDayReset: futureReset,
            blocked: false,
            rejected: false,
            unifiedRejected: false,
            fiveHourRejected: false,
            sevenDayRejected: false,
            modelWeeklyLimits: {},
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
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        },
        {
          token: 'token-b',
          fiveHourUtilization: 0,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should propagate the blocked status from the cache', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 5,
        fiveHourReset: futureReset,
        sevenDayUtilization: 0,
        sevenDayReset: futureReset,
        blocked: true,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 5,
          sevenDayUtilization: 0,
          blocked: true,
          rejected: false,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should propagate the rejected status from the cache', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 100,
        fiveHourReset: futureReset,
        sevenDayUtilization: 0,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: true,
        unifiedRejected: false,
        fiveHourRejected: true,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 100,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: true,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should normalize fiveHourUtilization to 0 when the 5h reset has passed', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 100,
        fiveHourReset: pastReset,
        sevenDayUtilization: 30,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 30,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should keep fiveHourUtilization when the 5h reset is in the future', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 95,
        fiveHourReset: futureReset,
        sevenDayUtilization: 0,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 95,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should clear a 5h-origin rejection once the 5h reset has passed', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 100,
        fiveHourReset: pastReset,
        sevenDayUtilization: 0,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: true,
        unifiedRejected: false,
        fiveHourRejected: true,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should clear a 7d-origin rejection once the 7d reset has passed', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
        sevenDayUtilization: 100,
        sevenDayReset: pastReset,
        blocked: false,
        rejected: true,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: true,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 10,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should keep a 5h-origin rejection while the 5h reset is in the future', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 100,
        fiveHourReset: futureReset,
        sevenDayUtilization: 0,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: true,
        unifiedRejected: false,
        fiveHourRejected: true,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 100,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: true,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should keep a still-active 7d rejection after the 5h reset has passed', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 100,
        fiveHourReset: pastReset,
        sevenDayUtilization: 100,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: true,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: true,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 100,
          blocked: false,
          rejected: true,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should clear a unified rejection once the 5h reset has passed', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 100,
        fiveHourReset: pastReset,
        sevenDayUtilization: 0,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: true,
        unifiedRejected: true,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
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
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should keep a model weekly rejection while its reset is in the future', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 5,
        fiveHourReset: futureReset,
        sevenDayUtilization: 10,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {
          seven_day_sonnet: { rejected: true, resetsAt: futureReset },
        },
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 5,
          sevenDayUtilization: 10,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {
            seven_day_sonnet: { rejected: true, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should clear a model weekly rejection once its reset has passed', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 5,
        fiveHourReset: futureReset,
        sevenDayUtilization: 10,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {
          seven_day_sonnet: { rejected: true, resetsAt: pastReset },
        },
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 5,
          sevenDayUtilization: 10,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {
            seven_day_sonnet: { rejected: false, resetsAt: pastReset },
          },
        },
      ]);
    });

    it('should normalize sevenDayUtilization to 0 when the 7d reset has passed', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
        sevenDayUtilization: 75,
        sevenDayReset: pastReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 10,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should keep sevenDayUtilization when the 7d reset is in the future', async () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
        sevenDayUtilization: 60,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          token: 'token-a',
          fiveHourUtilization: 10,
          sevenDayUtilization: 60,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
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
