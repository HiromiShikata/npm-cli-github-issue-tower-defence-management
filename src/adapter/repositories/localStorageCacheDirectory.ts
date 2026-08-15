import os from 'node:os';
import path from 'node:path';

export const tdpmCacheDirectory = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm');
};

export const localStorageCacheBaseDirectory = (): string =>
  path.join(tdpmCacheDirectory(), 'cache');

export const projectCacheDirectory = (projectName: string): string =>
  path.join(localStorageCacheBaseDirectory(), projectName);
