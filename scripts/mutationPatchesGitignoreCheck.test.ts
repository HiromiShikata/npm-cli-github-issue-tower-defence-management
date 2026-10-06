import { spawnSync } from 'child_process';
import * as path from 'path';

const repositoryRoot = path.resolve(__dirname, '..');

const runGitCheckIgnore = (
  relativePath: string,
): { readonly status: number | null } => {
  const result = spawnSync('git', ['check-ignore', '-q', relativePath], {
    cwd: repositoryRoot,
  });
  return { status: result.status };
};

const listTrackedMutationPatchArtifacts = (): string => {
  const result = spawnSync(
    'git',
    [
      'ls-files',
      '--',
      'mutation-patches/pr-*.patch',
      'mutation-patches/pr-*-result.txt',
    ],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  return result.stdout.trim();
};

describe('mutation-patches gitignore exclusion', () => {
  const cases: ReadonlyArray<{
    readonly relativePath: string;
    readonly expectedIgnored: boolean;
  }> = [
    { relativePath: 'mutation-patches/pr-1.patch', expectedIgnored: true },
    {
      relativePath: 'mutation-patches/pr-42-result.txt',
      expectedIgnored: true,
    },
    {
      relativePath: 'mutation-patches/pr-1-note.md',
      expectedIgnored: false,
    },
    {
      relativePath: 'mutation-patches/README.md',
      expectedIgnored: false,
    },
  ];

  it.each(cases)(
    'reports $relativePath as ignored=$expectedIgnored',
    ({ relativePath, expectedIgnored }) => {
      const { status } = runGitCheckIgnore(relativePath);
      expect(status).toBe(expectedIgnored ? 0 : 1);
    },
  );

  it('tracks no files matching the mutation-patches artifact patterns', () => {
    expect(listTrackedMutationPatchArtifacts()).toBe('');
  });
});
