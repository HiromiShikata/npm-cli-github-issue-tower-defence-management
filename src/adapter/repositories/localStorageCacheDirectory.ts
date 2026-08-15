import os from 'node:os';
import path from 'node:path';

export const localStorageCacheBaseDirectory = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'cache');
};

export const projectCacheDirectory = (projectName: string): string =>
  path.join(localStorageCacheBaseDirectory(), projectName);
