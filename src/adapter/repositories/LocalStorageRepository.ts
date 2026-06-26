import fs from 'fs';

export class LocalStorageRepository {
  write = (path: string, value: string) => {
    const dirPath = path.split('/').slice(0, -1).join('/');
    this.mkdir(dirPath);
    fs.writeFileSync(path, value, 'utf8');
  };
  read = (path: string): string | null => {
    return fs.readFileSync(path, 'utf8');
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
}
