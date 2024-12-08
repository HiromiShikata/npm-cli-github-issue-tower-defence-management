import fs from 'fs';
import { LocalStorageRepository } from './LocalStorageRepository';

type WriteParams = Parameters<LocalStorageRepository['write']>;
type ReadParams = Parameters<LocalStorageRepository['read']>;
type ReadReturn = ReturnType<LocalStorageRepository['read']>;
type ListFilesParams = Parameters<LocalStorageRepository['listFiles']>;
type ListFilesReturn = ReturnType<LocalStorageRepository['listFiles']>;
type MkdirParams = Parameters<LocalStorageRepository['mkdir']>;

describe('LocalStorageRepository', () => {
  const repository = new LocalStorageRepository();

  describe('write', () => {
    const testCases: Array<{
      name: string;
      params: WriteParams;
      expected: string;
    }> = [
      {
        name: 'writes content to file',
        params: ['tmp/test/LocalStorageRepository/file.txt', 'content'],
        expected: 'content',
      },
      {
        name: 'writes empty string to file',
        params: ['tmp/test/LocalStorageRepository/fileempty.txt', ''],
        expected: '',
      },
    ];

    testCases.forEach(({ name, params }) => {
      test(name, () => {
        if (fs.existsSync(params[0])) {
          fs.unlinkSync(params[0]);
        }
        repository.write(...params);
        const content = fs.readFileSync(params[0], 'utf8');
        expect(content).toBe(params[1]);
      });
    });
  });

  describe('read', () => {
    const testCases: Array<{
      name: string;
      params: ReadParams;
      content: string;
      expected: ReadReturn;
    }> = [
      {
        name: 'reads content from file',
        params: ['tmp/test/LocalStorageRepository/file.txt'],
        content: 'file content',
        expected: 'file content',
      },
      {
        name: 'reads empty file',
        params: ['tmp/test/LocalStorageRepository/fileempty.txt'],
        content: '',
        expected: '',
      },
    ];

    testCases.forEach(({ name, params, content, expected }) => {
      test(name, () => {
        if (fs.existsSync(params[0])) {
          fs.unlinkSync(params[0]);
        }
        repository.write(params[0], content);
        const result = repository.read(...params);
        expect(result).toBe(expected);
      });
    });
  });

  describe('listFiles', () => {
    const testCases: Array<{
      name: string;
      params: ListFilesParams;
      readdirSyncReturn: string[];
      expected: ListFilesReturn;
    }> = [
      {
        name: 'lists files in existing directory',
        params: ['tmp/test/LocalStorageRepository/exists'],
        readdirSyncReturn: ['file1.txt', 'file2.txt'],
        expected: ['file1.txt', 'file2.txt'],
      },
      {
        name: 'returns empty array for non-existing directory',
        params: ['tmp/test/LocalStorageRepository/nonexistent'],
        readdirSyncReturn: [],
        expected: [],
      },
    ];

    testCases.forEach(({ name, params, readdirSyncReturn, expected }) => {
      test(name, () => {
        if (readdirSyncReturn.length > 0) {
          if (!fs.existsSync(params[0])) {
            fs.mkdirSync(params[0], { recursive: true });
          }
          readdirSyncReturn.forEach((file) => {
            fs.writeFileSync(`${params[0]}/${file}`, 'content', 'utf8');
          });
        }
        const result = repository.listFiles(...params);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('mkdir', () => {
    const testCases: Array<{
      name: string;
      params: MkdirParams;
      expected: void;
    }> = [
      {
        name: 'creates directory with recursive option',
        params: ['tmp/test/LocalStorageRepository/newdir'],
        expected: undefined,
      },
      {
        name: 'creates nested directories',
        params: ['tmp/test/LocalStorageRepository/nested/newdir'],
        expected: undefined,
      },
    ];

    testCases.forEach(({ name, params }) => {
      test(name, () => {
        if (fs.existsSync(params[0])) {
          fs.rmdirSync(params[0], { recursive: true });
        }
        repository.mkdir(...params);
        expect(fs.existsSync(params[0])).toBe(true);
      });
    });
  });
});
