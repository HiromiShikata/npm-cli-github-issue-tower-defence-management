const mockEnsureProxyRunning = jest.fn();
const mockReadRateLimit = jest.fn();
const mockLoadTokenEntries = jest.fn();

jest.mock('../proxy/ensureProxyRunning', () => ({
  ensureProxyRunning: mockEnsureProxyRunning,
}));

jest.mock('../proxy/RateLimitCache', () => ({
  PROXY_PORT: 8787,
  readRateLimit: mockReadRateLimit,
}));

jest.mock('../proxy/TokenListLoader', () => ({
  loadTokenEntries: mockLoadTokenEntries,
}));

const mockFsReaddirSync = jest.fn();
const mockFsReadFileSync = jest.fn();
jest.mock('fs', () => ({
  readdirSync: mockFsReaddirSync,
  readFileSync: mockFsReadFileSync,
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
      expect(mockLoadTokenEntries.mock.calls).toHaveLength(0);
    });

    it('should return an empty list when the token list cannot be loaded', async () => {
      mockLoadTokenEntries.mockReturnValue(null);
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([]);
      expect(mockLoadTokenEntries.mock.calls).toEqual([['/tokens.json']]);
    });

    const futureReset = Math.floor(Date.now() / 1000) + 3600;
    const pastReset = Math.floor(Date.now() / 1000) - 3600;

    it('should map each token to its cached utilization and include name', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
        { name: 'bob', token: 'token-b' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 42,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: false, resetsAt: futureReset },
          },
        },
        {
          name: 'bob',
          token: 'token-b',
          fiveHourUtilization: 0,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should propagate the blocked status from the cache', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 5,
          sevenDayUtilization: 0,
          blocked: true,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: false, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should propagate the rejected status from the cache', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 100,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: true,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: false, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should normalize fiveHourUtilization to 0 when the 5h reset has passed', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 30,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: false, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should keep fiveHourUtilization when the 5h reset is in the future', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 95,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: false, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should clear a 5h-origin rejection once the 5h reset has passed', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: false, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should clear a 7d-origin rejection once the 7d reset has passed', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 10,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should keep a 5h-origin rejection while the 5h reset is in the future', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 100,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: true,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: false, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should keep a still-active 7d rejection after the 5h reset has passed', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 100,
          blocked: false,
          rejected: true,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: true, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should clear a unified rejection once the 5h reset has passed', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day: { rejected: false, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should default rejected to false when no snapshot exists', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
      mockReadRateLimit.mockReturnValue(null);
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result).toEqual([
        {
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 0,
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {},
        },
      ]);
    });

    it('should keep a model weekly rejection while its reset is in the future', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 5,
          sevenDayUtilization: 10,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day_sonnet: { rejected: true, resetsAt: futureReset },
          },
        },
      ]);
    });

    it('should clear a model weekly rejection once its reset has passed', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
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
          name: 'alice',
          token: 'token-a',
          fiveHourUtilization: 5,
          sevenDayUtilization: 10,
          blocked: false,
          rejected: false,
          blockedUntilEpoch: 0,
          modelWeeklyLimits: {
            seven_day_sonnet: { rejected: false, resetsAt: pastReset },
          },
        },
      ]);
    });

    it('should bridge sevenDayReset into a synthesized generic seven_day weekly limit when no model-specific weekly limit is present', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 12,
        fiveHourReset: futureReset,
        sevenDayUtilization: 33,
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

      expect(result[0].modelWeeklyLimits).toEqual({
        seven_day: { rejected: false, resetsAt: futureReset },
      });
    });

    it('should bridge sevenDayReset with rejected=true when sevenDayRejected is active and 7d reset is in the future', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
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

      expect(result[0].modelWeeklyLimits).toEqual({
        seven_day: { rejected: true, resetsAt: futureReset },
      });
    });

    it('should not bridge sevenDayReset when a generic seven_day weekly limit is already present', async () => {
      const existingResetsAt = futureReset + 1000;
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
        sevenDayUtilization: 50,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {
          seven_day: { rejected: false, resetsAt: existingResetsAt },
        },
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result[0].modelWeeklyLimits).toEqual({
        seven_day: { rejected: false, resetsAt: existingResetsAt },
      });
    });

    it('should not bridge sevenDayReset when a seven_day_opus weekly limit is already present', async () => {
      const opusResetsAt = futureReset + 2000;
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
        sevenDayUtilization: 50,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {
          seven_day_opus: { rejected: false, resetsAt: opusResetsAt },
        },
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result[0].modelWeeklyLimits).toEqual({
        seven_day_opus: { rejected: false, resetsAt: opusResetsAt },
      });
    });

    it('should not bridge sevenDayReset when a seven_day_sonnet weekly limit is already present', async () => {
      const sonnetResetsAt = futureReset + 3000;
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
        sevenDayUtilization: 50,
        sevenDayReset: futureReset,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {
          seven_day_sonnet: { rejected: false, resetsAt: sonnetResetsAt },
        },
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result[0].modelWeeklyLimits).toEqual({
        seven_day_sonnet: { rejected: false, resetsAt: sonnetResetsAt },
      });
    });

    it('should not bridge sevenDayReset when the 7d reset has already passed', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
        sevenDayUtilization: 0,
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

      expect(result[0].modelWeeklyLimits).toEqual({});
    });

    it('should not bridge sevenDayReset when sevenDayReset is 0', async () => {
      mockLoadTokenEntries.mockReturnValue([
        { name: 'alice', token: 'token-a' },
      ]);
      mockReadRateLimit.mockReturnValue({
        fiveHourUtilization: 10,
        fiveHourReset: futureReset,
        sevenDayUtilization: 0,
        sevenDayReset: 0,
        blocked: false,
        rejected: false,
        unifiedRejected: false,
        fiveHourRejected: false,
        sevenDayRejected: false,
        modelWeeklyLimits: {},
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getAvailableTokenUsages();

      expect(result[0].modelWeeklyLimits).toEqual({});
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

  describe('getTokenInFlightCounts', () => {
    const statWithParent = (parentPid: number): string =>
      `${parentPid + 1} (worker) S ${parentPid} ${parentPid} ${parentPid} 0 -1 4194304`;

    it('should return empty object when proc directory cannot be read', async () => {
      mockFsReaddirSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({});
    });

    it('should return empty object when no process has CLAUDE_CODE_OAUTH_TOKEN', async () => {
      mockFsReaddirSync.mockReturnValue(['1234', '5678', 'self']);
      mockFsReadFileSync.mockReturnValue('HOME=/home/user\0PATH=/usr/bin\0');
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({});
    });

    it('should count one worker root when one pid has CLAUDE_CODE_OAUTH_TOKEN', async () => {
      mockFsReaddirSync.mockReturnValue(['1234', 'self']);
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        if (filePath === '/proc/1234/environ') {
          return 'HOME=/home/user\0CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0PATH=/usr/bin\0';
        }
        if (filePath === '/proc/1234/stat') {
          return statWithParent(1);
        }
        throw new Error('EACCES');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1 });
    });

    it('should count one worker root when six descendant processes inherit the token from a single worker', async () => {
      mockFsReaddirSync.mockReturnValue([
        '100',
        '101',
        '102',
        '103',
        '104',
        '105',
      ]);
      const parentByPid: Record<string, number> = {
        '100': 1,
        '101': 100,
        '102': 100,
        '103': 101,
        '104': 103,
        '105': 104,
      };
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        const environMatch = filePath.match(/^\/proc\/(\d+)\/environ$/);
        if (environMatch) {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0OTHER=val\0';
        }
        const statMatch = filePath.match(/^\/proc\/(\d+)\/stat$/);
        if (statMatch) {
          return statWithParent(parentByPid[statMatch[1]]);
        }
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1 });
    });

    it('should count two worker roots when two workers run on the same token', async () => {
      mockFsReaddirSync.mockReturnValue([
        '200',
        '201',
        '202',
        '300',
        '301',
        '302',
      ]);
      const parentByPid: Record<string, number> = {
        '200': 1,
        '201': 200,
        '202': 201,
        '300': 1,
        '301': 300,
        '302': 301,
      };
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        const environMatch = filePath.match(/^\/proc\/(\d+)\/environ$/);
        if (environMatch) {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0';
        }
        const statMatch = filePath.match(/^\/proc\/(\d+)\/stat$/);
        if (statMatch) {
          return statWithParent(parentByPid[statMatch[1]]);
        }
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 2 });
    });

    it('should ignore processes without the token env var when counting worker roots', async () => {
      mockFsReaddirSync.mockReturnValue(['1234', '5678', '9999']);
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        if (filePath === '/proc/1234/environ') {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0OTHER=val\0';
        }
        if (filePath === '/proc/5678/environ') {
          return 'HOME=/home/user\0PATH=/usr/bin\0';
        }
        if (filePath === '/proc/9999/environ') {
          return 'CLAUDE_CODE_OAUTH_TOKEN=\0OTHER=val\0';
        }
        if (filePath === '/proc/1234/stat') {
          return statWithParent(1);
        }
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1 });
    });

    it('should count worker roots separately when they use different tokens', async () => {
      mockFsReaddirSync.mockReturnValue(['1234', '5678']);
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        if (filePath === '/proc/1234/environ') {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0';
        }
        if (filePath === '/proc/5678/environ') {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-xyz\0';
        }
        if (filePath === '/proc/1234/stat') {
          return statWithParent(1);
        }
        if (filePath === '/proc/5678/stat') {
          return statWithParent(1);
        }
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1, 'sk-ant-xyz': 1 });
    });

    it('should treat a worker root whose stat cannot be read as a worker root', async () => {
      mockFsReaddirSync.mockReturnValue(['1234']);
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        if (filePath === '/proc/1234/environ') {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0';
        }
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1 });
    });

    it('should parse the parent pid correctly when the process name contains spaces and parentheses', async () => {
      mockFsReaddirSync.mockReturnValue(['400', '401']);
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        if (
          filePath === '/proc/400/environ' ||
          filePath === '/proc/401/environ'
        ) {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0';
        }
        if (filePath === '/proc/400/stat') {
          return '400 (claude (worker) :) ) S 1 400 400 0 -1 4194304';
        }
        if (filePath === '/proc/401/stat') {
          return '401 (claude (worker) :) ) S 400 400 400 0 -1 4194304';
        }
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1 });
    });

    it('should treat a worker root whose stat is malformed as a worker root', async () => {
      mockFsReaddirSync.mockReturnValue(['1234']);
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        if (filePath === '/proc/1234/environ') {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0';
        }
        if (filePath === '/proc/1234/stat') {
          return '1234 (worker)';
        }
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1 });
    });

    it('should skip non-numeric proc entries', async () => {
      mockFsReaddirSync.mockReturnValue(['1234', 'self', 'net', 'sys']);
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        if (filePath === '/proc/1234/environ') {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0';
        }
        if (filePath === '/proc/1234/stat') {
          return statWithParent(1);
        }
        throw new Error('ENOENT');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1 });
    });

    it('should skip processes whose environ file cannot be read', async () => {
      mockFsReaddirSync.mockReturnValue(['1234', '5678']);
      mockFsReadFileSync.mockImplementation((filePath: string) => {
        if (filePath === '/proc/1234/environ') {
          return 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-abc\0';
        }
        if (filePath === '/proc/1234/stat') {
          return statWithParent(1);
        }
        throw new Error('EPERM');
      });
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({ 'sk-ant-abc': 1 });
    });

    it('should skip entries where CLAUDE_CODE_OAUTH_TOKEN has an empty value', async () => {
      mockFsReaddirSync.mockReturnValue(['1234']);
      mockFsReadFileSync.mockReturnValue(
        'CLAUDE_CODE_OAUTH_TOKEN=\0OTHER=val\0',
      );
      const repository = new ProxyClaudeTokenUsageRepository('/tokens.json');

      const result = await repository.getTokenInFlightCounts();

      expect(result).toEqual({});
    });
  });
});
