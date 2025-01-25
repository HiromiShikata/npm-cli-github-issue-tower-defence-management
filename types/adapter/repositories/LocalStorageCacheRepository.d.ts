import { LocalStorageRepository } from './LocalStorageRepository';
export declare class LocalStorageCacheRepository {
  readonly localStorageRepository: LocalStorageRepository;
  readonly cachePath: string;
  constructor(
    localStorageRepository: LocalStorageRepository,
    cachePath?: string,
  );
  getLatest: (key: string) => Promise<{
    value: object;
    timestamp: Date;
  } | null>;
  set: <T>(key: string, value: T) => Promise<void>;
}
//# sourceMappingURL=LocalStorageCacheRepository.d.ts.map
