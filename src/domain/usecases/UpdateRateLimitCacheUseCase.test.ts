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
    const pastReset = 1000000000;
    const nowEpochSeconds = 1000000100;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      { token: 'token-expired', unifiedReset: pastReset },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-expired',
    );
  });

  it('should not probe a token whose unifiedReset is in the future', async () => {
    const futureReset = 9999999999;
    const nowEpochSeconds = 1000000000;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      { token: 'token-active', unifiedReset: futureReset },
    ]);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).not.toHaveBeenCalled();
  });

  it('should probe only tokens with expired reset when mixed tokens exist', async () => {
    const pastReset = 1000000000;
    const futureReset = 9999999999;
    const nowEpochSeconds = 1000000100;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      { token: 'token-expired', unifiedReset: pastReset },
      { token: 'token-active', unifiedReset: futureReset },
    ]);
    mockRateLimitCacheRepository.probeToken.mockResolvedValue(undefined);

    await useCase.run({ nowEpochSeconds });

    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledTimes(1);
    expect(mockRateLimitCacheRepository.probeToken).toHaveBeenCalledWith(
      'token-expired',
    );
  });

  it('should update the cache after probing by relying on the repository side effect', async () => {
    const pastReset = 1000000000;
    const nowEpochSeconds = 1000000100;
    mockRateLimitCacheRepository.getTokenRateLimitCaches.mockReturnValue([
      { token: 'token-expired', unifiedReset: pastReset },
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
});
