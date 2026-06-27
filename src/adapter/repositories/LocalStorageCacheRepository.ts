import { LocalStorageRepository } from './LocalStorageRepository';

export class LocalStorageCacheRepository {
  constructor(
    readonly localStorageRepository: LocalStorageRepository,
    readonly cachePath = './tmp/cache',
  ) {}

  getLatest = async (
    key: string,
  ): Promise<{
    value: object;
    timestamp: Date;
  } | null> => {
    const dirPath = `${this.cachePath}/${key}`;
    const latestFile = this.localStorageRepository
      .listFiles(dirPath)
      .filter((fileName) => !fileName.endsWith('.tmp'))
      .sort((a, b) => a.localeCompare(b))
      .reverse()[0];
    if (!latestFile) {
      return null;
    }
    const valueStr = this.localStorageRepository.read(
      `${dirPath}/${latestFile}`,
    );
    if (!valueStr) {
      return null;
    }
    let value: unknown;
    try {
      value = JSON.parse(valueStr);
    } catch {
      return null;
    }
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const timestampStr = latestFile.split('.')[0];
    return {
      value,
      timestamp: new Date(timestampStr),
    };
  };
  set = async <T>(key: string, value: T): Promise<void> => {
    const dirPath = `${this.cachePath}/${key}`;
    this.localStorageRepository.mkdir(dirPath);
    const timestamp = new Date().toISOString();
    const finalPath = `${dirPath}/${timestamp}.json`;
    const tmpPath = `${finalPath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    this.localStorageRepository.write(tmpPath, JSON.stringify(value));
    this.localStorageRepository.rename(tmpPath, finalPath);
  };
}
