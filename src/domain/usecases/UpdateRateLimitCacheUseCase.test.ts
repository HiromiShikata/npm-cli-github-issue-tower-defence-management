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
        lastProbeEpoch: nowEpochSeconds,
      },
      {
        token: 'token-active',
        unifiedReset: futureReset,
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
        lastProbeEpoch: 0,
      },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-never-probed',
    );
  });
});
