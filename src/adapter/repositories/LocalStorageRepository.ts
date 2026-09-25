import fs from 'fs';

const isErrorWithCode = (err: unknown, code: string): boolean => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === code
  );
};

const readFileUtf8 = (path: string): string => {
  return fs.readFileSync(path, 'utf8');
};

export class LocalStorageRepository {
  write = (path: string, value: string) => {
    const dirPath = path.split('/').slice(0, -1).join('/');
    this.mkdir(dirPath);
    fs.writeFileSync(path, value, 'utf8');
  };
  read = (path: string): string | null => {
    return readFileUtf8(path);
  };
  rename = (oldPath: string, newPath: string) => {
    fs.renameSync(oldPath, newPath);
  };
  listFiles = (dirPath: string): string[] => {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    return fs.readdirSync(dirPath);
  };
  mkdir = (dirPath: string) => {
    fs.mkdirSync(dirPath, { recursive: true });
  };
  remove = (path: string) => {
    fs.rmSync(path, {
      force: true,
      recursive: true,
    });
  };
  tryCreateExclusive = (path: string): boolean => {
    try {
      const fileDescriptor = fs.openSync(
        path,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
      );
      fs.closeSync(fileDescriptor);
      return true;
    } catch (err) {
      if (isErrorWithCode(err, 'EEXIST')) {
        return false;
      }
      throw err;
    }
  };
  statMtimeMs = (path: string): number | null => {
    try {
      return fs.statSync(path).mtimeMs;
    } catch (err) {
      if (isErrorWithCode(err, 'ENOENT')) {
        return null;
      }
      console.warn(
        `LocalStorageRepository.statMtimeMs: failed to stat ${path}`,
        err,
      );
      return null;
    }
  };
  readOrNull = (path: string): string | null => {
    try {
      return readFileUtf8(path);
    } catch (err) {
      if (isErrorWithCode(err, 'ENOENT')) {
        return null;
      }
      console.warn(
        `LocalStorageRepository.readOrNull: failed to read ${path}`,
        err,
      );
      return null;
    }
  };
}
