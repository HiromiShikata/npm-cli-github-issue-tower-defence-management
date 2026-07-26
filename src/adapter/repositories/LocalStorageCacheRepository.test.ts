import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
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
    };
    repository = new LocalStorageCacheRepository(localStorageRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
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
});
