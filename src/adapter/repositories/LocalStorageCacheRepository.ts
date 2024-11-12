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
    } catch (e) {
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
    this.localStorageRepository.write(
      `${dirPath}/${timestamp}.json`,
      JSON.stringify(value),
    );
  };
}
