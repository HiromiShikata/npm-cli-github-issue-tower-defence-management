import fs from 'fs';
import path from 'path';
import { IssueTitleCacheRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';
import { IssueTitleInfo } from '../../domain/entities/PrReviewViewerItem';

type CacheStore = Record<string, IssueTitleInfo>;

export class FileSystemIssueTitleCacheRepository implements IssueTitleCacheRepository {
  private readonly filePath: string;
  private readonly inMemoryCache: Map<string, IssueTitleInfo> = new Map();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'issue_title_cache.json');
    this.loadFromDisk();
  }

  private cacheKey = (owner: string, repo: string, number: number): string =>
    `${owner}/${repo}#${number}`;

  private isIssueTitleInfo = (value: unknown): value is IssueTitleInfo => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    if (
      !('title' in value) ||
      !('state' in value) ||
      !('isPR' in value) ||
      !('url' in value)
    ) {
      return false;
    }
    return (
      typeof value['title'] === 'string' &&
      typeof value['state'] === 'string' &&
      typeof value['isPR'] === 'boolean' &&
      typeof value['url'] === 'string'
    );
  };

  private loadFromDisk = (): void => {
    if (!fs.existsSync(this.filePath)) {
      return;
    }
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }
      for (const [key, value] of Object.entries(parsed)) {
        if (this.isIssueTitleInfo(value)) {
          this.inMemoryCache.set(key, value);
        }
      }
    } catch (_error) {
      process.stderr.write(String(_error) + '\n');
    }
  };

  private saveToDisk = (): void => {
    const store: CacheStore = {};
    for (const [key, value] of this.inMemoryCache.entries()) {
      store[key] = value;
    }
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (_error) {
      process.stderr.write(String(_error) + '\n');
    }
  };

  get = async (
    owner: string,
    repo: string,
    number: number,
  ): Promise<IssueTitleInfo | null> => {
    const key = this.cacheKey(owner, repo, number);
    return this.inMemoryCache.get(key) ?? null;
  };

  set = async (
    owner: string,
    repo: string,
    number: number,
    info: IssueTitleInfo,
  ): Promise<void> => {
    const key = this.cacheKey(owner, repo, number);
    this.inMemoryCache.set(key, info);
    this.saveToDisk();
  };
}
