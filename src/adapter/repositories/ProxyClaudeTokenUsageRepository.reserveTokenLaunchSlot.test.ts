import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ProxyClaudeTokenUsageRepository,
  TOKEN_LAUNCH_RESERVATION_TTL_MS,
  hashTokenForReservationDirectory,
} from './ProxyClaudeTokenUsageRepository';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { ProcTakeOwnershipWorkerSessionReader } from './ProcTakeOwnershipWorkerSessionReader';

describe('ProxyClaudeTokenUsageRepository.reserveTokenLaunchSlot', () => {
  let tempCacheDir: string;

  const buildRepository = (
    workerSessionReader?: ProcTakeOwnershipWorkerSessionReader,
  ): ProxyClaudeTokenUsageRepository =>
    new ProxyClaudeTokenUsageRepository(
      null,
      8787,
      new LocalStorageCacheRepository(
        new LocalStorageRepository(),
        tempCacheDir,
      ),
      workerSessionReader,
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
      issueUrl: 'https://github.com/user/repo/issues/101',
    });
    const second = await repository.reserveTokenLaunchSlot({
      token: 'token-a',
      concurrentLimit: 1,
      issueUrl: 'https://github.com/user/repo/issues/102',
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('returns true and durably records the reservation so a later call from an independently-constructed instance sees it', async () => {
    const repository = buildRepository();

    const granted = await repository.reserveTokenLaunchSlot({
      token: 'token-b',
      concurrentLimit: 2,
      issueUrl: 'https://github.com/user/repo/issues/201',
    });

    const otherRepository = buildRepository();
    const secondGranted = await otherRepository.reserveTokenLaunchSlot({
      token: 'token-b',
      concurrentLimit: 2,
      issueUrl: 'https://github.com/user/repo/issues/202',
    });
    const thirdDenied = await otherRepository.reserveTokenLaunchSlot({
      token: 'token-b',
      concurrentLimit: 2,
      issueUrl: 'https://github.com/user/repo/issues/203',
    });

    expect(granted).toBe(true);
    expect(secondGranted).toBe(true);
    expect(thirdDenied).toBe(false);
  });

  it('does not count a reservation older than the configured reservation TTL toward the limit, and the TTL is set to survive the 420 second launcher hold', async () => {
    jest.useFakeTimers({ advanceTimers: false });
    const start = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(start);
    const repository = buildRepository();

    const fillGranted = await repository.reserveTokenLaunchSlot({
      token: 'token-c',
      concurrentLimit: 1,
      issueUrl: 'https://github.com/user/repo/issues/301',
    });

    jest.setSystemTime(new Date(start.getTime() + 420_000));
    const stillBlockedAfterLauncherHoldDuration =
      await repository.reserveTokenLaunchSlot({
        token: 'token-c',
        concurrentLimit: 1,
        issueUrl: 'https://github.com/user/repo/issues/302',
      });

    jest.setSystemTime(
      new Date(start.getTime() + TOKEN_LAUNCH_RESERVATION_TTL_MS + 1),
    );
    const grantedAfterExpiry = await repository.reserveTokenLaunchSlot({
      token: 'token-c',
      concurrentLimit: 1,
      issueUrl: 'https://github.com/user/repo/issues/303',
    });

    expect(fillGranted).toBe(true);
    expect(stillBlockedAfterLauncherHoldDuration).toBe(false);
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
          issueUrl: `https://github.com/user/repo/issues/${400 + i}`,
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

  it('grants the slot and deletes a reservation file whose content is truncated invalid JSON left by a crashed writer, instead of throwing or counting it toward the limit', async () => {
    const tokenReservationDirectoryPath = path.join(
      tempCacheDir,
      'token-reservations',
      hashTokenForReservationDirectory('token-a'),
    );
    fs.mkdirSync(tokenReservationDirectoryPath, { recursive: true });
    const corruptReservationFilePath = path.join(
      tokenReservationDirectoryPath,
      `${randomUUID()}.json`,
    );
    fs.writeFileSync(corruptReservationFilePath, '{"reservedAt":');
    const repository = buildRepository();

    const granted = await repository.reserveTokenLaunchSlot({
      token: 'token-a',
      concurrentLimit: 1,
      issueUrl: 'https://github.com/user/repo/issues/501',
    });

    expect(granted).toBe(true);
    expect(fs.existsSync(corruptReservationFilePath)).toBe(false);
  });

  it("excludes and removes a reservation whose issue URL already appears in a live worker's command line, regardless of which token that worker runs on", async () => {
    const issueUrl = 'https://github.com/user/repo/issues/42';
    const tokenReservationDirectoryPath = path.join(
      tempCacheDir,
      'token-reservations',
      hashTokenForReservationDirectory('token-d'),
    );
    fs.mkdirSync(tokenReservationDirectoryPath, { recursive: true });
    const staleReservationFilePath = path.join(
      tokenReservationDirectoryPath,
      `${randomUUID()}.json`,
    );
    fs.writeFileSync(
      staleReservationFilePath,
      JSON.stringify({ reservedAt: Date.now(), issueUrl }),
    );
    const workerSessionReader = new ProcTakeOwnershipWorkerSessionReader(
      path.join(tempCacheDir, 'nonexistent-proc'),
    );
    workerSessionReader.listWorkerSessions = () => [
      {
        rootProcessId: 1,
        sessionToken: 'unused-session-token',
        workerProcesses: [
          {
            processId: 1,
            rawCommandLine: `claude --model opus "Take ownership of ${issueUrl}"`,
          },
        ],
      },
    ];
    const repository = buildRepository(workerSessionReader);

    const granted = await repository.reserveTokenLaunchSlot({
      token: 'token-d',
      concurrentLimit: 1,
      issueUrl: 'https://github.com/user/repo/issues/999',
    });

    expect(granted).toBe(true);
    expect(fs.existsSync(staleReservationFilePath)).toBe(false);
  });

  it('still counts a reservation for a shorter issue URL toward the limit when a live worker is only running for a different issue whose URL happens to start with that same prefix', async () => {
    const shorterIssueUrl = 'https://github.com/user/repo/issues/29';
    const unrelatedLongerIssueUrl = 'https://github.com/user/repo/issues/2970';
    const tokenReservationDirectoryPath = path.join(
      tempCacheDir,
      'token-reservations',
      hashTokenForReservationDirectory('token-g'),
    );
    fs.mkdirSync(tokenReservationDirectoryPath, { recursive: true });
    const staleReservationFilePath = path.join(
      tokenReservationDirectoryPath,
      `${randomUUID()}.json`,
    );
    fs.writeFileSync(
      staleReservationFilePath,
      JSON.stringify({ reservedAt: Date.now(), issueUrl: shorterIssueUrl }),
    );
    const workerSessionReader = new ProcTakeOwnershipWorkerSessionReader(
      path.join(tempCacheDir, 'nonexistent-proc'),
    );
    workerSessionReader.listWorkerSessions = () => [
      {
        rootProcessId: 4,
        sessionToken: 'unrelated-session-token',
        workerProcesses: [
          {
            processId: 4,
            rawCommandLine: `claude --model opus "Take ownership of ${unrelatedLongerIssueUrl}"`,
          },
        ],
      },
    ];
    const repository = buildRepository(workerSessionReader);

    const denied = await repository.reserveTokenLaunchSlot({
      token: 'token-g',
      concurrentLimit: 1,
      issueUrl: 'https://github.com/user/repo/issues/999',
    });

    expect(denied).toBe(false);
    expect(fs.existsSync(staleReservationFilePath)).toBe(true);
  });

  it('does not double count a reservation once the real in-flight worker for its issue URL is running under that same token, still granting a slot for a different issue under the same token', async () => {
    const issueUrl = 'https://github.com/user/repo/issues/55';
    const tokenReservationDirectoryPath = path.join(
      tempCacheDir,
      'token-reservations',
      hashTokenForReservationDirectory('token-f'),
    );
    fs.mkdirSync(tokenReservationDirectoryPath, { recursive: true });
    const staleReservationFilePath = path.join(
      tokenReservationDirectoryPath,
      `${randomUUID()}.json`,
    );
    fs.writeFileSync(
      staleReservationFilePath,
      JSON.stringify({ reservedAt: Date.now(), issueUrl }),
    );
    const workerSessionReader = new ProcTakeOwnershipWorkerSessionReader(
      path.join(tempCacheDir, 'nonexistent-proc'),
    );
    workerSessionReader.listWorkerSessions = () => [
      {
        rootProcessId: 3,
        sessionToken: 'token-f',
        workerProcesses: [
          {
            processId: 3,
            rawCommandLine: `claude --model opus "Take ownership of ${issueUrl}"`,
          },
        ],
      },
    ];
    const repository = buildRepository(workerSessionReader);

    const granted = await repository.reserveTokenLaunchSlot({
      token: 'token-f',
      concurrentLimit: 2,
      issueUrl: 'https://github.com/user/repo/issues/56',
    });

    expect(granted).toBe(true);
    expect(fs.existsSync(staleReservationFilePath)).toBe(false);
  });

  it("counts a real in-flight worker session running under a token toward that same token's concurrent limit, denying a further reservation for it", async () => {
    const workerSessionReader = new ProcTakeOwnershipWorkerSessionReader(
      path.join(tempCacheDir, 'nonexistent-proc'),
    );
    workerSessionReader.listWorkerSessions = () => [
      {
        rootProcessId: 2,
        sessionToken: 'token-e',
        workerProcesses: [
          { processId: 2, rawCommandLine: 'claude --model opus' },
        ],
      },
    ];
    const repository = buildRepository(workerSessionReader);

    const denied = await repository.reserveTokenLaunchSlot({
      token: 'token-e',
      concurrentLimit: 1,
      issueUrl: 'https://github.com/user/repo/issues/7',
    });

    expect(denied).toBe(false);
  });
});
