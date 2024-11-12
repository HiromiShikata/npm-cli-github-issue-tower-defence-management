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

  beforeEach(() => {
    repository = new LocalStorageRepository();
    mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation();
    mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockImplementation();
    mockReaddirSync = jest.spyOn(fs, 'readdirSync').mockImplementation();
    mockMkdirSync = jest.spyOn(fs, 'mkdirSync').mockImplementation();
    mockExistsSync = jest.spyOn(fs, 'existsSync').mockImplementation();
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
});
