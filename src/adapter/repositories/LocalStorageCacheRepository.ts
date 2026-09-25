import { localStorageCacheBaseDirectory } from './localStorageCacheDirectory';
import { LocalStorageRepository } from './LocalStorageRepository';

export type Sleep = (milliseconds: number) => Promise<void>;

const realSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const PROJECT_CACHE_LOCK_STALE_TIMEOUT_MS = 30_000;

export const PROJECT_CACHE_LOCK_ACQUIRE_TIMEOUT_MS = 30_000;

export const PROJECT_CACHE_LOCK_RETRY_DELAY_MS = 50;

export class LocalStorageCacheRepository {
  constructor(
    readonly localStorageRepository: LocalStorageRepository,
    readonly cachePath = localStorageCacheBaseDirectory(),
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
  getSingle = async (key: string): Promise<unknown> => {
    const dirPath = `${this.cachePath}/${key}`;
    const fileName = 'latest.json';
    if (!this.localStorageRepository.listFiles(dirPath).includes(fileName)) {
      return null;
    }
    const valueStr = this.localStorageRepository.read(`${dirPath}/${fileName}`);
    if (!valueStr) {
      return null;
    }
    try {
      return JSON.parse(valueStr);
    } catch {
      return null;
    }
  };
  setSingle = async <T>(key: string, value: T): Promise<void> => {
    const dirPath = `${this.cachePath}/${key}`;
    this.localStorageRepository.mkdir(dirPath);
    const finalPath = `${dirPath}/latest.json`;
    const tmpPath = `${finalPath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    this.localStorageRepository.write(tmpPath, JSON.stringify(value));
    this.localStorageRepository.rename(tmpPath, finalPath);
  };
  withLock = async <T>(
    key: string,
    fn: () => Promise<T>,
    sleep: Sleep = realSleep,
    now: () => number = Date.now,
  ): Promise<T> => {
    const dirPath = `${this.cachePath}/${key}`;
    const lockPath = `${dirPath}/.write.lock`;
    this.localStorageRepository.mkdir(dirPath);
    const deadline = now() + PROJECT_CACHE_LOCK_ACQUIRE_TIMEOUT_MS;
    for (;;) {
      if (this.localStorageRepository.tryCreateExclusive(lockPath)) {
        break;
      }
      const mtimeMs = this.localStorageRepository.statMtimeMs(lockPath);
      if (
        mtimeMs !== null &&
        now() - mtimeMs >= PROJECT_CACHE_LOCK_STALE_TIMEOUT_MS
      ) {
        this.localStorageRepository.remove(lockPath);
        continue;
      }
      if (now() >= deadline) {
        throw new Error(`Timed out waiting for project cache lock: ${key}`);
      }
      await sleep(PROJECT_CACHE_LOCK_RETRY_DELAY_MS);
    }
    try {
      return await fn();
    } finally {
      this.localStorageRepository.remove(lockPath);
    }
  };
}
