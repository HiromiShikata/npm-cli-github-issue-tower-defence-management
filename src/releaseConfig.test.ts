import { readFileSync } from 'fs';
import { join } from 'path';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isCommitAnalyzerEntry = (
  plugin: unknown,
): plugin is [string, Record<string, unknown>] =>
  Array.isArray(plugin) &&
  plugin[0] === '@semantic-release/commit-analyzer' &&
  isRecord(plugin[1]);

const readCommitAnalyzerReleaseRules = (): unknown => {
  const raw: unknown = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  );
  if (!isRecord(raw) || !isRecord(raw.release)) {
    throw new Error('package.json must declare a release section');
  }
  const plugins = raw.release.plugins;
  if (!Array.isArray(plugins)) {
    throw new Error('package.json must declare release.plugins');
  }
  const entry = plugins.find(isCommitAnalyzerEntry);
  if (entry === undefined) {
    throw new Error(
      'commit-analyzer plugin must be configured with options in package.json',
    );
  }
  return entry[1].releaseRules;
};

describe('release config', () => {
  it('releases a patch version for a revert commit', () => {
    expect(readCommitAnalyzerReleaseRules()).toEqual(
      expect.arrayContaining([{ type: 'revert', release: 'patch' }]),
    );
  });
});
