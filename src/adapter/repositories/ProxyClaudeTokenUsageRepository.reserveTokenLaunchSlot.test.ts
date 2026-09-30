import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProxyClaudeTokenUsageRepository } from './ProxyClaudeTokenUsageRepository';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

describe('ProxyClaudeTokenUsageRepository.reserveTokenLaunchSlot', () => {
  let tempCacheDir: string;

  const buildRepository = (): ProxyClaudeTokenUsageRepository =>
    new ProxyClaudeTokenUsageRepository(
      null,
      8787,
      new LocalStorageCacheRepository(
        new LocalStorageRepository(),
        tempCacheDir,
      ),
    );

  beforeEach(() => {
    tempCacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'reserve-token-launch-slot-test-'),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(tempCacheDir, { recursive: true, force: true });
  });

  it('returns false once the real in-flight count plus reservations already reached the concurrent limit', async () => {
    const repository = buildRepository();

    const first = await repository.reserveTokenLaunchSlot({
      token: 'token-a',
      concurrentLimit: 1,
    });
    const second = await repository.reserveTokenLaunchSlot({
      token: 'token-a',
      concurrentLimit: 1,
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('returns true and durably records the reservation so a later call from an independently-constructed instance sees it', async () => {
    const repository = buildRepository();

    const granted = await repository.reserveTokenLaunchSlot({
      token: 'token-b',
      concurrentLimit: 2,
    });

    const otherRepository = buildRepository();
    const secondGranted = await otherRepository.reserveTokenLaunchSlot({
      token: 'token-b',
      concurrentLimit: 2,
    });
    const thirdDenied = await otherRepository.reserveTokenLaunchSlot({
      token: 'token-b',
      concurrentLimit: 2,
    });

    expect(granted).toBe(true);
    expect(secondGranted).toBe(true);
    expect(thirdDenied).toBe(false);
  });

  it('does not count a reservation older than the 60 second reservation TTL toward the limit', async () => {
    jest.useFakeTimers({ advanceTimers: false });
    const reservationTtlMs = 60_000;
    const start = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(start);
    const repository = buildRepository();

    const fillGranted = await repository.reserveTokenLaunchSlot({
      token: 'token-c',
      concurrentLimit: 1,
    });
    const blockedBeforeExpiry = await repository.reserveTokenLaunchSlot({
      token: 'token-c',
      concurrentLimit: 1,
    });

    jest.setSystemTime(new Date(start.getTime() + reservationTtlMs + 1));
    const grantedAfterExpiry = await repository.reserveTokenLaunchSlot({
      token: 'token-c',
      concurrentLimit: 1,
    });

    expect(fillGranted).toBe(true);
    expect(blockedBeforeExpiry).toBe(false);
    expect(grantedAfterExpiry).toBe(true);
  });

  it('grants exactly the concurrent limit across two independently-constructed instances racing concurrently against the same shared token', async () => {
    const repositoryA = buildRepository();
    const repositoryB = buildRepository();
    const concurrentLimit = 2;
    const totalAttempts = concurrentLimit + 3;

    const results = await Promise.all(
      Array.from({ length: totalAttempts }, (_, i) =>
        (i % 2 === 0 ? repositoryA : repositoryB).reserveTokenLaunchSlot({
          token: 'shared-token',
          concurrentLimit,
        }),
      ),
    );

    expect(results.filter((granted) => granted === true)).toHaveLength(
      concurrentLimit,
    );
    expect(results.filter((granted) => granted === false)).toHaveLength(
      totalAttempts - concurrentLimit,
    );
  });
});
