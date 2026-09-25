import fs from 'fs';
import { LocalStorageRepository } from './LocalStorageRepository';

type WriteParams = Parameters<LocalStorageRepository['write']>;
type ReadParams = Parameters<LocalStorageRepository['read']>;
type ReadReturn = ReturnType<LocalStorageRepository['read']>;
type ListFilesParams = Parameters<LocalStorageRepository['listFiles']>;
type ListFilesReturn = ReturnType<LocalStorageRepository['listFiles']>;
type MkdirParams = Parameters<LocalStorageRepository['mkdir']>;

describe('LocalStorageRepository', () => {
  let repository: LocalStorageRepository;
  let mockWriteFileSync: jest.SpyInstance;
  let mockReadFileSync: jest.SpyInstance;
  let mockReaddirSync: jest.SpyInstance;
  let mockMkdirSync: jest.SpyInstance;
  let mockExistsSync: jest.SpyInstance;
  let mockRenameSync: jest.SpyInstance;
  let mockOpenSync: jest.SpyInstance;
  let mockCloseSync: jest.SpyInstance;
  let mockStatSync: jest.SpyInstance;

  beforeEach(() => {
    repository = new LocalStorageRepository();
    mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation();
    mockReadFileSync = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(() => '');
    mockReaddirSync = jest.spyOn(fs, 'readdirSync').mockImplementation();
    mockMkdirSync = jest.spyOn(fs, 'mkdirSync').mockImplementation();
    mockExistsSync = jest.spyOn(fs, 'existsSync').mockImplementation();
    mockRenameSync = jest.spyOn(fs, 'renameSync').mockImplementation();
    mockOpenSync = jest.spyOn(fs, 'openSync').mockImplementation();
    mockCloseSync = jest.spyOn(fs, 'closeSync').mockImplementation();
    mockStatSync = jest.spyOn(fs, 'statSync').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('write', () => {
    const testCases: Array<{
      name: string;
      params: WriteParams;
      expected: void;
    }> = [
      {
        name: 'writes content to file',
        params: ['/path/to/file.txt', 'content'],
        expected: undefined,
      },
      {
        name: 'writes empty string to file',
        params: ['/path/to/file.txt', ''],
        expected: undefined,
      },
    ];

    testCases.forEach(({ name, params }) => {
      test(name, () => {
        repository.write(...params);
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          params[0],
          params[1],
          'utf8',
        );
      });
    });
  });

  describe('rename', () => {
    test('renames a file from the old path to the new path', () => {
      repository.rename('/path/to/file.txt.tmp', '/path/to/file.txt');
      expect(mockRenameSync).toHaveBeenCalledWith(
        '/path/to/file.txt.tmp',
        '/path/to/file.txt',
      );
    });
  });

  describe('read', () => {
    const testCases: Array<{
      name: string;
      params: ReadParams;
      mockReturn: string;
      expected: ReadReturn;
    }> = [
      {
        name: 'reads content from file',
        params: ['/path/to/file.txt'],
        mockReturn: 'file content',
        expected: 'file content',
      },
      {
        name: 'reads empty file',
        params: ['/path/to/empty.txt'],
        mockReturn: '',
        expected: '',
      },
    ];

    testCases.forEach(({ name, params, mockReturn, expected }) => {
      test(name, () => {
        mockReadFileSync.mockReturnValue(mockReturn);
        const result = repository.read(...params);
        expect(result).toBe(expected);
        expect(mockReadFileSync).toHaveBeenCalledWith(params[0], 'utf8');
      });
    });
  });

  describe('listFiles', () => {
    const testCases: Array<{
      name: string;
      params: ListFilesParams;
      existsSyncReturn: boolean;
      readdirSyncReturn: string[];
      expected: ListFilesReturn;
    }> = [
      {
        name: 'lists files in existing directory',
        params: ['/path/to/dir'],
        existsSyncReturn: true,
        readdirSyncReturn: ['file1.txt', 'file2.txt'],
        expected: ['file1.txt', 'file2.txt'],
      },
      {
        name: 'returns empty array for non-existing directory',
        params: ['/path/to/nonexistent'],
        existsSyncReturn: false,
        readdirSyncReturn: [],
        expected: [],
      },
    ];

    testCases.forEach(
      ({ name, params, existsSyncReturn, readdirSyncReturn, expected }) => {
        test(name, () => {
          mockExistsSync.mockReturnValue(existsSyncReturn);
          mockReaddirSync.mockReturnValue(readdirSyncReturn);
          const result = repository.listFiles(...params);
          expect(result).toEqual(expected);
          if (existsSyncReturn) {
            expect(mockReaddirSync).toHaveBeenCalledWith(params[0]);
          } else {
            expect(mockReaddirSync).not.toHaveBeenCalled();
          }
        });
      },
    );
  });

  describe('mkdir', () => {
    const testCases: Array<{
      name: string;
      params: MkdirParams;
      expected: void;
    }> = [
      {
        name: 'creates directory with recursive option',
        params: ['/path/to/new/dir'],
        expected: undefined,
      },
      {
        name: 'creates nested directories',
        params: ['/deeply/nested/directory/path'],
        expected: undefined,
      },
    ];

    testCases.forEach(({ name, params }) => {
      test(name, () => {
        repository.mkdir(...params);
        expect(mockMkdirSync).toHaveBeenCalledWith(params[0], {
          recursive: true,
        });
      });
    });
  });

  describe('tryCreateExclusive', () => {
    test('opens the path exclusively, closes the descriptor, and returns true when creation succeeds', () => {
      mockOpenSync.mockReturnValue(7);

      const result = repository.tryCreateExclusive('/path/to/.write.lock');

      expect(result).toBe(true);
      expect(mockOpenSync).toHaveBeenCalledWith(
        '/path/to/.write.lock',
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
      );
      expect(mockCloseSync).toHaveBeenCalledWith(7);
    });

    test('returns false without throwing when the path already exists (EEXIST)', () => {
      const eexistError = Object.assign(new Error('file already exists'), {
        code: 'EEXIST',
      });
      mockOpenSync.mockImplementation(() => {
        throw eexistError;
      });

      const result = repository.tryCreateExclusive('/path/to/.write.lock');

      expect(result).toBe(false);
      expect(mockCloseSync).not.toHaveBeenCalled();
    });

    test('rethrows an error whose code is not EEXIST', () => {
      const permissionError = Object.assign(new Error('permission denied'), {
        code: 'EACCES',
      });
      mockOpenSync.mockImplementation(() => {
        throw permissionError;
      });

      expect(() =>
        repository.tryCreateExclusive('/path/to/.write.lock'),
      ).toThrow(permissionError);
    });
  });

  describe('statMtimeMs', () => {
    test('returns the last-modified time in milliseconds for an existing path', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1735689600000 });

      const result = repository.statMtimeMs('/path/to/.write.lock');

      expect(result).toBe(1735689600000);
      expect(mockStatSync).toHaveBeenCalledWith('/path/to/.write.lock');
    });

    test('returns null when the path does not exist', () => {
      const enoentError = Object.assign(new Error('no such file'), {
        code: 'ENOENT',
      });
      mockStatSync.mockImplementation(() => {
        throw enoentError;
      });

      const result = repository.statMtimeMs('/path/to/missing.lock');

      expect(result).toBeNull();
    });

    test('returns null when any other stat error occurs', () => {
      mockStatSync.mockImplementation(() => {
        throw new Error('unexpected stat failure');
      });

      const result = repository.statMtimeMs('/path/to/.write.lock');

      expect(result).toBeNull();
    });

    test('logs a warning when any other stat error occurs', () => {
      const mockConsoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation();
      const unexpectedError = Object.assign(
        new Error('permission denied'),
        { code: 'EACCES' },
      );
      mockStatSync.mockImplementation(() => {
        throw unexpectedError;
      });

      repository.statMtimeMs('/path/to/.write.lock');

      expect(mockConsoleWarn).toHaveBeenCalled();

      mockConsoleWarn.mockRestore();
    });

    test('does not log a warning when the path does not exist (ENOENT)', () => {
      const mockConsoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation();
      const enoentError = Object.assign(new Error('no such file'), {
        code: 'ENOENT',
      });
      mockStatSync.mockImplementation(() => {
        throw enoentError;
      });

      repository.statMtimeMs('/path/to/missing.lock');

      expect(mockConsoleWarn).not.toHaveBeenCalled();

      mockConsoleWarn.mockRestore();
    });
  });

  describe('readOrNull', () => {
    test('returns the file content as utf8 text when the file exists', () => {
      mockReadFileSync.mockReturnValue('file content');

      const result = repository.readOrNull('/path/to/file.txt');

      expect(result).toBe('file content');
      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/path/to/file.txt',
        'utf8',
      );
    });

    test('returns null without throwing when the file does not exist (ENOENT)', () => {
      const enoentError = Object.assign(new Error('no such file'), {
        code: 'ENOENT',
      });
      mockReadFileSync.mockImplementation(() => {
        throw enoentError;
      });

      const result = repository.readOrNull('/path/to/missing.txt');

      expect(result).toBeNull();
    });

    test('does not log a warning when the file does not exist (ENOENT)', () => {
      const mockConsoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation();
      const enoentError = Object.assign(new Error('no such file'), {
        code: 'ENOENT',
      });
      mockReadFileSync.mockImplementation(() => {
        throw enoentError;
      });

      repository.readOrNull('/path/to/missing.txt');

      expect(mockConsoleWarn).not.toHaveBeenCalled();

      mockConsoleWarn.mockRestore();
    });

    test('returns null without throwing when any other read error occurs', () => {
      const permissionError = Object.assign(
        new Error('permission denied'),
        { code: 'EACCES' },
      );
      mockReadFileSync.mockImplementation(() => {
        throw permissionError;
      });

      const result = repository.readOrNull('/path/to/file.txt');

      expect(result).toBeNull();
    });

    test('logs a warning when any other read error occurs', () => {
      const mockConsoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation();
      const permissionError = Object.assign(
        new Error('permission denied'),
        { code: 'EACCES' },
      );
      mockReadFileSync.mockImplementation(() => {
        throw permissionError;
      });

      repository.readOrNull('/path/to/file.txt');

      expect(mockConsoleWarn).toHaveBeenCalled();

      mockConsoleWarn.mockRestore();
    });
  });
});
