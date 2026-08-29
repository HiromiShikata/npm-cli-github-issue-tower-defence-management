import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findConsoleItemUrl } from './consoleItemUrlLookup';

describe('findConsoleItemUrl', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-lookup-'));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  const writeList = (tab: string, items: unknown): void => {
    const dir = path.join(baseDir, 'acme', tab);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'list.json'), JSON.stringify({ items }));
  };

  it('returns the stored url when the requested url is listed in a tab', () => {
    writeList('prs', [{ url: 'https://github.com/o/r/issues/1' }]);
    expect(
      findConsoleItemUrl(baseDir, 'acme', 'https://github.com/o/r/issues/1'),
    ).toBe('https://github.com/o/r/issues/1');
  });

  it('returns null when no tab lists the requested url', () => {
    writeList('prs', [{ url: 'https://github.com/o/r/issues/1' }]);
    expect(
      findConsoleItemUrl(baseDir, 'acme', 'https://github.com/o/r/issues/2'),
    ).toBeNull();
  });

  it('returns null when the project directory does not exist', () => {
    expect(
      findConsoleItemUrl(baseDir, 'unknown', 'https://github.com/o/r/issues/1'),
    ).toBeNull();
  });

  it('ignores a tab file that is not valid json', () => {
    const dir = path.join(baseDir, 'acme', 'failed-preparation');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'list.json'), 'not json');
    writeList('prs', [{ url: 'https://github.com/o/r/issues/1' }]);
    expect(
      findConsoleItemUrl(baseDir, 'acme', 'https://github.com/o/r/issues/1'),
    ).toBe('https://github.com/o/r/issues/1');
  });

  it('ignores entries without a url string', () => {
    writeList('prs', [
      { url: 1 },
      null,
      { url: 'https://github.com/o/r/pull/9' },
    ]);
    expect(
      findConsoleItemUrl(baseDir, 'acme', 'https://github.com/o/r/pull/9'),
    ).toBe('https://github.com/o/r/pull/9');
  });
});
