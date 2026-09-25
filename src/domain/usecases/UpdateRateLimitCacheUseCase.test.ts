import { UpdateRateLimitCacheUseCase } from './UpdateRateLimitCacheUseCase';
import { mock } from 'jest-mock-extended';
import { RateLimitCacheRepository } from './adapter-interfaces/RateLimitCacheRepository';

describe('UpdateRateLimitCacheUseCase', () => {
  const mockRateLimitCacheRepository = mock<RateLimitCacheRepository>();

  const useCase = new UpdateRateLimitCacheUseCase(mockRateLimitCacheRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should probe a token whose unifiedReset is in the past', async () => {
    const nowEpochSeconds = 1000000100;
    const pastReset = 1000000000;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-expired',
        unifiedReset: pastReset,
        sevenDayReset: 0,
        lastProbeEpoch: nowEpochSeconds,
      },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-expired',
    );
  });

  it('should not probe a token whose unifiedReset is in the future and was probed within the last hour', async () => {
    const nowEpochSeconds = 1000000000;
    const futureReset = nowEpochSeconds + 1800;
    const tenMinutesAgo = nowEpochSeconds - 600;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-active',
        unifiedReset: futureReset,
        sevenDayReset: 0,
        lastProbeEpoch: tenMinutesAgo,
      },
    ]);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).not.toHaveBeenCalled();
  });

  it('should probe only tokens with expired reset when mixed tokens exist', async () => {
    const nowEpochSeconds = 1000000100;
    const pastReset = 1000000000;
    const futureReset = nowEpochSeconds + 1800;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-expired',
        unifiedReset: pastReset,
        sevenDayReset: 0,
        lastProbeEpoch: nowEpochSeconds,
      },
      {
        token: 'token-active',
        unifiedReset: futureReset,
        sevenDayReset: 0,
        lastProbeEpoch: nowEpochSeconds,
      },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledTimes(1);
    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-expired',
    );
  });

  it('should update the cache after probing by relying on the repository side effect', async () => {
    const nowEpochSeconds = 1000000100;
    const pastReset = 1000000000;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-expired',
        unifiedReset: pastReset,
        sevenDayReset: 0,
        lastProbeEpoch: nowEpochSeconds,
      },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-expired',
    );
  });

  it('should handle an empty token list without errors', async () => {
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([]);

    await useCase.run({ nowEpochSeconds: 1000000000 });

    expect(mockRateLimitCacheRepository.probeToken).not.toHaveBeenCalled();
  });

  it('should probe a token whose last probe was 61 minutes ago even when unifiedReset is in the future', async () => {
    const nowEpochSeconds = 1000000000;
    const futureReset = nowEpochSeconds + 7200;
    const sixtyOneMinutesAgo = nowEpochSeconds - 61 * 60;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-stale-probe',
        unifiedReset: futureReset,
        sevenDayReset: 0,
        lastProbeEpoch: sixtyOneMinutesAgo,
      },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-stale-probe',
    );
  });

  it('should not probe a token whose last probe was 10 minutes ago', async () => {
    const nowEpochSeconds = 1000000000;
    const futureReset = nowEpochSeconds + 7200;
    const tenMinutesAgo = nowEpochSeconds - 10 * 60;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-fresh-probe',
        unifiedReset: futureReset,
        sevenDayReset: 0,
        lastProbeEpoch: tenMinutesAgo,
      },
    ]);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).not.toHaveBeenCalled();
  });

  it('should probe a token with unifiedReset in the past regardless of last probe time', async () => {
    const nowEpochSeconds = 1000000000;
    const pastReset = nowEpochSeconds - 60;
    const oneMinuteAgo = nowEpochSeconds - 60;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-expired-recent-probe',
        unifiedReset: pastReset,
        sevenDayReset: 0,
        lastProbeEpoch: oneMinuteAgo,
      },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-expired-recent-probe',
    );
  });

  it('should probe a token that has never been probed even when unifiedReset is in the future', async () => {
    const nowEpochSeconds = 1000000000;
    const futureReset = nowEpochSeconds + 7200;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-never-probed',
        unifiedReset: futureReset,
        sevenDayReset: 0,
        lastProbeEpoch: 0,
      },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-never-probed',
    );
  });

  it('should probe a token whose seven-day reset passed after its last probe even when unifiedReset is in the future and the last probe was within the last hour', async () => {
    const nowEpochSeconds = 1000000000;
    const futureReset = nowEpochSeconds + 4 * 3600;
    const sevenDayResetTwoMinutesAgo = nowEpochSeconds - 2 * 60;
    const fiveMinutesAgo = nowEpochSeconds - 5 * 60;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-seven-day-reset-passed',
        unifiedReset: futureReset,
        sevenDayReset: sevenDayResetTwoMinutesAgo,
        lastProbeEpoch: fiveMinutesAgo,
      },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-seven-day-reset-passed',
    );
  });

  it('should not probe a token whose seven-day reset passed before its last probe within the last hour', async () => {
    const nowEpochSeconds = 1000000000;
    const futureReset = nowEpochSeconds + 4 * 3600;
    const sevenDayResetTenMinutesAgo = nowEpochSeconds - 10 * 60;
    const fiveMinutesAgo = nowEpochSeconds - 5 * 60;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-probed-after-seven-day-reset',
        unifiedReset: futureReset,
        sevenDayReset: sevenDayResetTenMinutesAgo,
        lastProbeEpoch: fiveMinutesAgo,
      },
    ]);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).not.toHaveBeenCalled();
  });

  it('should not probe a token whose seven-day reset is in the future and was probed within the last hour', async () => {
    const nowEpochSeconds = 1000000000;
    const futureReset = nowEpochSeconds + 4 * 3600;
    const sevenDayResetInOneDay = nowEpochSeconds + 86400;
    const fiveMinutesAgo = nowEpochSeconds - 5 * 60;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      {
        token: 'token-seven-day-reset-in-future',
        unifiedReset: futureReset,
        sevenDayReset: sevenDayResetInOneDay,
        lastProbeEpoch: fiveMinutesAgo,
      },
    ]);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).not.toHaveBeenCalled();
  });
});
