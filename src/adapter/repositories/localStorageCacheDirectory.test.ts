import os from 'node:os';
import path from 'node:path';
import {
  localStorageCacheBaseDirectory,
  projectCacheDirectory,
} from './localStorageCacheDirectory';

describe('localStorageCacheBaseDirectory', () => {
  const originalXdgCacheHome = process.env.XDG_CACHE_HOME;
  const originalWorkingDirectory = process.cwd();

  afterEach(() => {
    if (originalXdgCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = originalXdgCacheHome;
    }
    process.chdir(originalWorkingDirectory);
  });

  test('places the cache below XDG_CACHE_HOME when it is set', () => {
    process.env.XDG_CACHE_HOME = '/var/tmp/xdg-cache-home-for-test';

    expect(localStorageCacheBaseDirectory()).toBe(
      '/var/tmp/xdg-cache-home-for-test/tdpm/cache',
    );
  });

  test('places the cache below the home cache directory when XDG_CACHE_HOME is absent', () => {
    delete process.env.XDG_CACHE_HOME;

    expect(localStorageCacheBaseDirectory()).toBe(
      path.join(os.homedir(), '.cache', 'tdpm', 'cache'),
    );
  });

  test('resolves to the same absolute directory from two working directories, so a session started in its own worktree reads what the other sessions cached', () => {
    delete process.env.XDG_CACHE_HOME;

    const fromCurrentDirectory = projectCacheDirectory('acme');
    process.chdir(os.tmpdir());

    expect(projectCacheDirectory('acme')).toBe(fromCurrentDirectory);
    expect(path.isAbsolute(fromCurrentDirectory)).toBe(true);
  });
});

describe('projectCacheDirectory', () => {
  test('places the project below the shared base directory', () => {
    expect(projectCacheDirectory('acme')).toBe(
      path.join(localStorageCacheBaseDirectory(), 'acme'),
    );
  });
});
