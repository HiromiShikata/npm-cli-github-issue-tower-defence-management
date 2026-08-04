import { readFileSync } from 'fs';
import { join } from 'path';

type ReleaseRule = { type?: string; release?: string };
type CommitAnalyzerOptions = { releaseRules?: ReleaseRule[] };
type PluginEntry = string | [string, CommitAnalyzerOptions];
type PackageJson = { release: { plugins: PluginEntry[] } };

const readCommitAnalyzerOptions = (): CommitAnalyzerOptions => {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  ) as PackageJson;
  const entry = packageJson.release.plugins.find(
    (plugin) =>
      Array.isArray(plugin) && plugin[0] === '@semantic-release/commit-analyzer',
  );
  if (!Array.isArray(entry)) {
    throw new Error(
      'commit-analyzer plugin must be configured with options in package.json',
    );
  }
  return entry[1];
};

describe('release config', () => {
  it('releases a patch version for a revert commit', () => {
    const options = readCommitAnalyzerOptions();
    expect(options.releaseRules).toEqual(
      expect.arrayContaining([{ type: 'revert', release: 'patch' }]),
    );
  });
});
