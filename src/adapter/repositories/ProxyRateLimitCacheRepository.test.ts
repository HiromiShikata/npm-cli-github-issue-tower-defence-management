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

    it('should return fiveHourReset as unifiedReset for a token with a cached snapshot', () => {
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
      });
      const repository = new ProxyRateLimitCacheRepository('/tokens.json');

      const result = repository.getTokenRateLimitCaches();

      expect(result).toEqual([{ token: 'token-a', unifiedReset: futureReset }]);
    });

    it('should return unifiedReset of 0 when no snapshot exists for a token', () => {
      mockLoadTokens.mockReturnValue(['token-a']);
      mockReadRateLimit.mockReturnValue(null);
      const repository = new ProxyRateLimitCacheRepository('/tokens.json');

      const result = repository.getTokenRateLimitCaches();

      expect(result).toEqual([{ token: 'token-a', unifiedReset: 0 }]);
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
          };
        }
        return null;
      });
      const repository = new ProxyRateLimitCacheRepository('/tokens.json');

      const result = repository.getTokenRateLimitCaches();

      expect(result).toEqual([
        { token: 'token-a', unifiedReset: futureReset },
        { token: 'token-b', unifiedReset: 0 },
      ]);
    });
  });
});
