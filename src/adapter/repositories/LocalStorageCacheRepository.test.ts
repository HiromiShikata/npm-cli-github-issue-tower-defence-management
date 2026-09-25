import {
  LocalStorageCacheRepository,
  PROJECT_CACHE_LOCK_ACQUIRE_TIMEOUT_MS,
  PROJECT_CACHE_LOCK_STALE_TIMEOUT_MS,
  Sleep,
} from './LocalStorageCacheRepository';
import { localStorageCacheBaseDirectory } from './localStorageCacheDirectory';
import { LocalStorageRepository } from './LocalStorageRepository';

describe('LocalStorageCacheRepository', () => {
  let localStorageRepository: jest.Mocked<LocalStorageRepository>;
  let repository: LocalStorageCacheRepository;
  let now: Date;

  beforeEach(() => {
    now = new Date('2024-01-01T00:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(now);

    localStorageRepository = {
      listFiles: jest.fn(),
      read: jest.fn(),
      write: jest.fn(),
      rename: jest.fn(),
      mkdir: jest.fn(),
      remove: jest.fn(),
      tryCreateExclusive: jest.fn(),
      statMtimeMs: jest.fn(),
      readOrNull: jest.fn(),
    };
    repository = new LocalStorageCacheRepository(
      localStorageRepository,
      './tmp/cache',
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('defaults its base to the shared cache directory, so a process started in any working directory reads what the others cached', () => {
    const defaulted = new LocalStorageCacheRepository(localStorageRepository);

    expect(defaulted.cachePath).toBe(localStorageCacheBaseDirectory());
  });

  describe('getLatest', () => {
    type GetLatestParams = Parameters<LocalStorageCacheRepository['getLatest']>;
    type GetLatestReturn = ReturnType<LocalStorageCacheRepository['getLatest']>;

    interface TestCase {
      name: string;
      key: GetLatestParams[0];
      files: string[];
      fileContent: string | null;
      expected: Awaited<GetLatestReturn>;
    }

    const testCases: TestCase[] = [
      {
        name: 'returns null when no files exist',
        key: 'test-key',
        files: [],
        fileContent: null,
        expected: null,
      },
      {
        name: 'returns null when file content is empty',
        key: 'test-key',
        files: ['2024-01-01T00:00:00.000Z'],
        fileContent: null,
        expected: null,
      },
      {
        name: 'returns null when content is invalid JSON',
        key: 'test-key',
        files: ['2024-01-01T00:00:00.000Z'],
        fileContent: 'invalid-json',
        expected: null,
      },
      {
        name: 'returns value when valid JSON exists',
        key: 'test-key',
        files: ['2024-01-01T00:00:00.000Z'],
        fileContent: '{"test": "value"}',
        expected: {
          value: { test: 'value' },
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
        },
      },
      {
        name: 'ignores in-progress temp files and reads the latest committed file',
        key: 'test-key',
        files: [
          '2024-01-01T00:00:00.000Z.json',
          '2024-01-01T00:00:01.000Z.json.1234.abc.tmp',
        ],
        fileContent: '{"test": "value"}',
        expected: {
          value: { test: 'value' },
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
        },
      },
    ];

    test.each(testCases)(
      '$name',
      async ({ key, files, fileContent, expected }) => {
        localStorageRepository.listFiles.mockReturnValue(files);
        localStorageRepository.read.mockReturnValue(fileContent);

        const result = await repository.getLatest(key);

        expect(result).toEqual(expected);
      },
    );
  });

  describe('set', () => {
    type SetParams = Parameters<LocalStorageCacheRepository['set']>;

    interface TestCase {
      name: string;
      key: SetParams[0];
      value: SetParams[1];
      expectedDirPath: string;
      expectedFilePath: string;
      expectedContent: string;
    }

    const testCases: TestCase[] = [
      {
        name: 'stores string value',
        key: 'test-key',
        value: 'test-value',
        expectedDirPath: './tmp/cache/test-key',
        expectedFilePath: './tmp/cache/test-key/2024-01-01T00:00:00.000Z.json',
        expectedContent: '"test-value"',
      },
      {
        name: 'stores object value',
        key: 'test-key',
        value: { test: 'value' },
        expectedDirPath: './tmp/cache/test-key',
        expectedFilePath: './tmp/cache/test-key/2024-01-01T00:00:00.000Z.json',
        expectedContent: '{"test":"value"}',
      },
      {
        name: 'stores array value',
        key: 'test-key',
        value: [1, 2, 3],
        expectedDirPath: './tmp/cache/test-key',
        expectedFilePath: './tmp/cache/test-key/2024-01-01T00:00:00.000Z.json',
        expectedContent: '[1,2,3]',
      },
    ];

    test.each(testCases)(
      '$name',
      async ({
        key,
        value,
        expectedDirPath,
        expectedFilePath,
        expectedContent,
      }) => {
        await repository.set(key, value);

        expect(localStorageRepository.mkdir).toHaveBeenCalledWith(
          expectedDirPath,
        );
        const writeArgs = localStorageRepository.write.mock.calls[0];
        const writtenPath = writeArgs[0];
        expect(writtenPath.startsWith(`${expectedFilePath}.`)).toBe(true);
        expect(writtenPath.endsWith('.tmp')).toBe(true);
        expect(writeArgs[1]).toBe(expectedContent);
        expect(localStorageRepository.rename).toHaveBeenCalledWith(
          writtenPath,
          expectedFilePath,
        );
      },
    );

    test('writes to the temp file before renaming it into place', async () => {
      const callOrder: string[] = [];
      localStorageRepository.write.mockImplementation(() => {
        callOrder.push('write');
      });
      localStorageRepository.rename.mockImplementation(() => {
        callOrder.push('rename');
      });

      await repository.set('ordering-key', { ordered: true });

      expect(callOrder).toEqual(['write', 'rename']);
    });
  });

  describe('getSingle', () => {
    test('returns null when latest.json does not exist', async () => {
      localStorageRepository.listFiles.mockReturnValue([]);

      const result = await repository.getSingle('test-key');

      expect(result).toBeNull();
      expect(localStorageRepository.read).not.toHaveBeenCalled();
    });

    test('returns null when the file content is empty', async () => {
      localStorageRepository.listFiles.mockReturnValue(['latest.json']);
      localStorageRepository.read.mockReturnValue(null);

      const result = await repository.getSingle('test-key');

      expect(result).toBeNull();
    });

    test('returns null when the file content is invalid JSON', async () => {
      localStorageRepository.listFiles.mockReturnValue(['latest.json']);
      localStorageRepository.read.mockReturnValue('not-json');

      const result = await repository.getSingle('test-key');

      expect(result).toBeNull();
    });

    test('returns the parsed value from latest.json', async () => {
      localStorageRepository.listFiles.mockReturnValue(['latest.json']);
      localStorageRepository.read.mockReturnValue('{"lastFetchedAt":"x"}');

      const result = await repository.getSingle('test-key');

      expect(result).toEqual({ lastFetchedAt: 'x' });
      expect(localStorageRepository.read).toHaveBeenCalledWith(
        './tmp/cache/test-key/latest.json',
      );
    });
  });

  describe('setSingle', () => {
    test('atomically writes a temp file then renames it to latest.json', async () => {
      await repository.setSingle('test-key', { test: 'value' });

      expect(localStorageRepository.mkdir).toHaveBeenCalledWith(
        './tmp/cache/test-key',
      );
      const writeArgs = localStorageRepository.write.mock.calls[0];
      const writtenPath = writeArgs[0];
      const finalPath = './tmp/cache/test-key/latest.json';
      expect(writtenPath.startsWith(`${finalPath}.`)).toBe(true);
      expect(writtenPath.endsWith('.tmp')).toBe(true);
      expect(writeArgs[1]).toBe('{"test":"value"}');
      expect(localStorageRepository.rename).toHaveBeenCalledWith(
        writtenPath,
        finalPath,
      );
    });

    test('writes to the temp file before renaming it into place', async () => {
      const callOrder: string[] = [];
      localStorageRepository.write.mockImplementation(() => {
        callOrder.push('write');
      });
      localStorageRepository.rename.mockImplementation(() => {
        callOrder.push('rename');
      });

      await repository.setSingle('ordering-key', { ordered: true });

      expect(callOrder).toEqual(['write', 'rename']);
    });
  });

  describe('withLock', () => {
    const cachePath = './tmp/cache';

    const buildTrackedLock = () => {
      const heldLockPaths = new Set<string>();
      const tokenByLockPath = new Map<string, string>();
      localStorageRepository.tryCreateExclusive.mockImplementation(
        (path: string) => {
          if (heldLockPaths.has(path)) {
            return false;
          }
          heldLockPaths.add(path);
          return true;
        },
      );
      localStorageRepository.write.mockImplementation(
        (path: string, value: string) => {
          tokenByLockPath.set(path, value);
        },
      );
      localStorageRepository.readOrNull.mockImplementation(
        (path: string) => tokenByLockPath.get(path) ?? null,
      );
      localStorageRepository.remove.mockImplementation((path: string) => {
        heldLockPaths.delete(path);
        tokenByLockPath.delete(path);
      });
      return heldLockPaths;
    };

    test('runs fn and returns its result when the lock is uncontended', async () => {
      buildTrackedLock();
      localStorageRepository.statMtimeMs.mockReturnValue(null);
      const lockPath = `${cachePath}/project-key/.write.lock`;

      const result = await repository.withLock(
        'project-key',
        async () => 'ran',
      );

      expect(result).toBe('ran');
      expect(localStorageRepository.mkdir).toHaveBeenCalledWith(
        `${cachePath}/project-key`,
      );
      expect(localStorageRepository.tryCreateExclusive).toHaveBeenCalledWith(
        lockPath,
      );
      expect(localStorageRepository.write).toHaveBeenCalledWith(
        lockPath,
        expect.any(String),
      );
      expect(localStorageRepository.readOrNull).toHaveBeenCalledWith(
        lockPath,
      );
      expect(localStorageRepository.remove).toHaveBeenCalledWith(lockPath);
    });

    test('a second call for the same key does not start fn until the first call finishes and releases the lock', async () => {
      buildTrackedLock();
      localStorageRepository.statMtimeMs.mockReturnValue(1_000);
      const fakeSleep: Sleep = jest.fn(async () => {
        await Promise.resolve();
      });
      const fakeNow = () => 1_050;
      const order: string[] = [];
      let resolveFirst: () => void = () => {};

      const first = jest.fn(async () => {
        order.push('first-start');
        await new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
        order.push('first-end');
        return 'first-result';
      });
      const second = jest.fn(async () => {
        order.push('second-start');
        return 'second-result';
      });

      const firstCall = repository.withLock(
        'same-key',
        first,
        fakeSleep,
        fakeNow,
      );
      const secondCall = repository.withLock(
        'same-key',
        second,
        fakeSleep,
        fakeNow,
      );

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(second).not.toHaveBeenCalled();

      resolveFirst();
      const [firstResult, secondResult] = await Promise.all([
        firstCall,
        secondCall,
      ]);

      expect(order).toEqual(['first-start', 'first-end', 'second-start']);
      expect(firstResult).toBe('first-result');
      expect(secondResult).toBe('second-result');
      expect(localStorageRepository.write).toHaveBeenCalledWith(
        `${cachePath}/same-key/.write.lock`,
        expect.any(String),
      );
    });

    test('a call for a different key is not blocked by a lock held on another key', async () => {
      buildTrackedLock();
      localStorageRepository.statMtimeMs.mockReturnValue(null);
      const order: string[] = [];
      let resolveFirst: () => void = () => {};

      const first = jest.fn(async () => {
        order.push('first-start');
        await new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
        order.push('first-end');
        return 'first-result';
      });
      const second = jest.fn(async () => {
        order.push('second-start');
        return 'second-result';
      });

      const firstCall = repository.withLock('key-a', first);
      const secondCall = repository.withLock('key-b', second);

      const secondResult = await secondCall;

      expect(secondResult).toBe('second-result');
      expect(order).toEqual(['first-start', 'second-start']);

      resolveFirst();
      await firstCall;
    });

    test('releases the lock even when fn throws, so a later acquire on the same key still succeeds', async () => {
      buildTrackedLock();
      localStorageRepository.statMtimeMs.mockReturnValue(null);
      const failure = new Error('boom');

      await expect(
        repository.withLock('throwing-key', async () => {
          throw failure;
        }),
      ).rejects.toThrow(failure);

      expect(localStorageRepository.remove).toHaveBeenCalledWith(
        `${cachePath}/throwing-key/.write.lock`,
      );
      expect(localStorageRepository.write).toHaveBeenCalledWith(
        `${cachePath}/throwing-key/.write.lock`,
        expect.any(String),
      );

      const recovered = await repository.withLock(
        'throwing-key',
        async () => 'recovered',
      );

      expect(recovered).toBe('recovered');
    });

    test('takes over a lock file older than the stale timeout instead of waiting for it to be released', async () => {
      localStorageRepository.tryCreateExclusive
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      const now = 1_000_000;
      localStorageRepository.statMtimeMs.mockReturnValue(
        now - PROJECT_CACHE_LOCK_STALE_TIMEOUT_MS,
      );
      let writtenToken: string | undefined;
      localStorageRepository.write.mockImplementation(
        (_path: string, value: string) => {
          writtenToken = value;
        },
      );
      localStorageRepository.readOrNull.mockImplementation(
        () => writtenToken ?? null,
      );
      const fakeSleep: Sleep = jest.fn(async () => {
        await Promise.resolve();
      });
      const fakeNow = () => now;
      const lockPath = `${cachePath}/stale-key/.write.lock`;

      const result = await repository.withLock(
        'stale-key',
        async () => 'ran-after-takeover',
        fakeSleep,
        fakeNow,
      );

      expect(result).toBe('ran-after-takeover');
      expect(localStorageRepository.tryCreateExclusive).toHaveBeenCalledTimes(
        2,
      );
      expect(localStorageRepository.write).toHaveBeenCalledWith(
        lockPath,
        expect.any(String),
      );
      expect(localStorageRepository.readOrNull).toHaveBeenCalledWith(
        lockPath,
      );
      expect(localStorageRepository.remove).toHaveBeenCalledWith(lockPath);
      expect(fakeSleep).not.toHaveBeenCalled();
    });

    test('rejects with an Error naming the lock and key when the lock cannot be acquired within the acquire timeout', async () => {
      localStorageRepository.tryCreateExclusive.mockReturnValue(false);
      localStorageRepository.statMtimeMs.mockReturnValue(null);
      const startNow = 2_000_000;
      let nowCallCount = 0;
      const fakeNow = jest.fn(() => {
        nowCallCount += 1;
        return nowCallCount === 1
          ? startNow
          : startNow + PROJECT_CACHE_LOCK_ACQUIRE_TIMEOUT_MS + 1;
      });
      const fakeSleep: Sleep = jest.fn(async () => {
        await Promise.resolve();
      });
      const fn = jest.fn(async () => 'never-runs');

      let thrown: unknown;
      try {
        await repository.withLock('stuck-key', fn, fakeSleep, fakeNow);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      if (!(thrown instanceof Error))
        throw new Error('Expected Error instance');
      expect(thrown.message).toMatch(/lock/i);
      expect(thrown.message).toContain('stuck-key');
      expect(fn).not.toHaveBeenCalled();
      expect(fakeSleep).not.toHaveBeenCalled();
    });

    test('a slow holder releasing late does not delete a lock file that a later stale-timeout takeover already reclaimed with its own token', async () => {
      const lockPath = `${cachePath}/race-key/.write.lock`;
      let locked = false;
      const lockFileContents = new Map<string, string>();
      const removeCallPaths: string[] = [];

      localStorageRepository.tryCreateExclusive.mockImplementation(
        (path: string) => {
          if (path !== lockPath) return true;
          if (locked) return false;
          locked = true;
          return true;
        },
      );
      localStorageRepository.write.mockImplementation(
        (path: string, value: string) => {
          lockFileContents.set(path, value);
        },
      );
      localStorageRepository.readOrNull.mockImplementation(
        (path: string) => lockFileContents.get(path) ?? null,
      );
      localStorageRepository.remove.mockImplementation((path: string) => {
        removeCallPaths.push(path);
        locked = false;
        lockFileContents.delete(path);
      });
      localStorageRepository.statMtimeMs.mockReturnValue(
        -PROJECT_CACHE_LOCK_STALE_TIMEOUT_MS,
      );

      let resolveSlowHolder: () => void = () => {};
      const slowHolderFn = jest.fn(async () => {
        await new Promise<void>((resolve) => {
          resolveSlowHolder = resolve;
        });
        return 'slow-holder-result';
      });
      const takeoverFn = jest.fn(async () => 'takeover-result');

      const slowHolderCall = repository.withLock('race-key', slowHolderFn);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(slowHolderFn).toHaveBeenCalled();

      const removeCallsBeforeTakeover = removeCallPaths.length;

      const takeoverCall = repository.withLock('race-key', takeoverFn);
      const takeoverResult = await takeoverCall;

      expect(takeoverResult).toBe('takeover-result');
      expect(removeCallPaths.length).toBe(removeCallsBeforeTakeover + 2);

      resolveSlowHolder();
      const slowHolderResult = await slowHolderCall;

      expect(slowHolderResult).toBe('slow-holder-result');
      expect(removeCallPaths.length).toBe(removeCallsBeforeTakeover + 2);
    });
  });
});
