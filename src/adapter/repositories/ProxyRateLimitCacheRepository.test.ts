const mockReadRateLimit = jest.fn();
const mockLoadTokens = jest.fn();

jest.mock('../proxy/RateLimitCache', () => ({
  PROXY_PORT: 8787,
  readRateLimit: mockReadRateLimit,
}));

jest.mock('../proxy/TokenListLoader', () => ({
  loadTokens: mockLoadTokens,
}));

import { ProxyRateLimitCacheRepository } from './ProxyRateLimitCacheRepository';

describe('ProxyRateLimitCacheRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTokenRateLimitCaches', () => {
    it('should return an empty list when no token path is configured', () => {
      const repository = new ProxyRateLimitCacheRepository(null);

      const result = repository.getTokenRateLimitCaches();

      expect(result).toEqual([]);
      expect(mockLoadTokens).not.toHaveBeenCalled();
    });

    it('should return an empty list when the token list cannot be loaded', () => {
      mockLoadTokens.mockReturnValue(null);
      const repository = new ProxyRateLimitCacheRepository('/tokens.json');

      const result = repository.getTokenRateLimitCaches();

      expect(result).toEqual([]);
    });

    const futureReset = Math.floor(Date.now() / 1000) + 3600;
    const recentEpoch = Math.floor(Date.now() / 1000) - 60;

    it('should return fiveHourReset as unifiedReset and ts as lastProbeEpoch for a token with a cached snapshot', () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue({
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
        lastUpdatedEpoch: recentEpoch,
      });
      const repository = new ProxyRateLimitCacheRepository('/tokens.json');

      const result = repository.getTokenRateLimitCaches();

      expect(result).toEqual([
        {
          token: 'token-a',
          unifiedReset: futureReset,
          lastProbeEpoch: recentEpoch,
        },
      ]);
    });

    it('should return unifiedReset of 0 and lastProbeEpoch of 0 when no snapshot exists for a token', () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue(null);
      const repository = new ProxyRateLimitCacheRepository('/tokens.json');

      const result = repository.getTokenRateLimitCaches();

      expect(result).toEqual([
        { token: 'token-a', unifiedReset: 0, lastProbeEpoch: 0 },
      ]);
    });

    it('should return entries for all tokens in the list', () => {
      mockLoadTokens.mockReturnValue(['token-a', 'token-b']);
      mockReadRateLimit.mockImplementation((token: string) => {
        if (token === 'token-a') {
          return {
            fiveHourUtilization: 10,
            fiveHourReset: futureReset,
            sevenDayUtilization: 0,
            sevenDayReset: futureReset,
            blocked: false,
            rejected: false,
            unifiedRejected: false,
            fiveHourRejected: false,
            sevenDayRejected: false,
            modelWeeklyLimits: {},
            lastUpdatedEpoch: recentEpoch,
          };
        }
        return null;
      });
      const repository = new ProxyRateLimitCacheRepository('/tokens.json');

      const result = repository.getTokenRateLimitCaches();

      expect(result).toEqual([
        {
          token: 'token-a',
          unifiedReset: futureReset,
          lastProbeEpoch: recentEpoch,
        },
        { token: 'token-b', unifiedReset: 0, lastProbeEpoch: 0 },
      ]);
    });
  });
});
