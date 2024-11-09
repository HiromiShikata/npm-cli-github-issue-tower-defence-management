import fs from 'fs';

export class LocalStorageRepository {
  write = (path: string, value: string) => {
    fs.writeFileSync(path, value, 'utf8');
  };
  read = (path: string): string => {
    return fs.readFileSync(path, 'utf8');
  };
}
