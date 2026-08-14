import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const workflowDirectory = path.join(repositoryRoot, '.github', 'workflows');
const defaultBranchRef = 'refs/heads/main';
const nonDefaultBranchOnlyCancellation = `\${{ github.ref != '${defaultBranchRef}' }}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readWorkflowSource = (fileName: string): string =>
  fs.readFileSync(path.join(workflowDirectory, fileName), 'utf8');

const readWorkflowConcurrency = (fileName: string): Record<string, unknown> => {
  const workflow: unknown = parse(readWorkflowSource(fileName));
  if (!isRecord(workflow)) {
    throw new Error(`${fileName} does not parse to a workflow mapping`);
  }
  const concurrency = workflow['concurrency'];
  if (concurrency === undefined) {
    return {};
  }
  if (!isRecord(concurrency)) {
    throw new Error(
      `${fileName} declares a concurrency value that is not a mapping`,
    );
  }
  return concurrency;
};

const workflowFileNames = (): string[] =>
  fs
    .readdirSync(workflowDirectory)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();

const pushesCommitsToTheRepository = (fileName: string): boolean => {
  const source = readWorkflowSource(fileName);
  return (
    source.includes('git-auto-commit-action') || source.includes('git push')
  );
};

const concurrencyGroupForPush = (
  workflowPrefix: string,
  ref: string,
  sha: string,
): string => `${workflowPrefix}-${ref === defaultBranchRef ? sha : ref}`;

const concurrencyGroupExpression = (workflowPrefix: string): string =>
  `${workflowPrefix}-\${{ github.ref == '${defaultBranchRef}' && github.sha || github.ref }}`;

const guardedWorkflows = [
  { fileName: 'test.yml', workflowPrefix: 'test' },
  { fileName: 'console-ui.yml', workflowPrefix: 'console-ui' },
];

describe('push-triggered workflow run cancellation', () => {
  describe('concurrency group behavior', () => {
    it('gives each default-branch commit its own group so queued runs survive incoming commits', () => {
      expect(
        concurrencyGroupForPush('test', defaultBranchRef, 'abc123'),
      ).not.toBe(
        concurrencyGroupForPush('test', defaultBranchRef, 'def456'),
      );
    });

    it('gives all pushes of the same feature branch the same group so superseded runs are cancelled', () => {
      const featureBranchRef = 'refs/heads/feature/my-feature';
      expect(
        concurrencyGroupForPush('test', featureBranchRef, 'abc123'),
      ).toBe(concurrencyGroupForPush('test', featureBranchRef, 'def456'));
    });

    it('keeps groups distinct across workflows so unrelated workflows never cancel each other', () => {
      const groups = guardedWorkflows.map(({ workflowPrefix }) =>
        concurrencyGroupForPush(workflowPrefix, defaultBranchRef, 'abc123'),
      );
      expect(new Set(groups).size).toBe(groups.length);
    });
  });

  it.each(guardedWorkflows)(
    'keys the concurrency group of $fileName on the commit sha for default branch or the ref for other branches',
    ({ fileName, workflowPrefix }) => {
      expect(readWorkflowConcurrency(fileName)['group']).toBe(
        concurrencyGroupExpression(workflowPrefix),
      );
    },
  );

  it('gives every guarded workflow its own concurrency group so unrelated runs never cancel each other', () => {
    const groups = guardedWorkflows.map(({ fileName }) =>
      readWorkflowConcurrency(fileName)['group'],
    );
    expect(new Set(groups).size).toBe(groups.length);
  });

  it.each(guardedWorkflows)(
    'cancels a superseded run of $fileName only when the pushed ref is not the default branch',
    ({ fileName }) => {
      expect(readWorkflowConcurrency(fileName)['cancel-in-progress']).toBe(
        nonDefaultBranchOnlyCancellation,
      );
    },
  );

  it.each(workflowFileNames().filter(pushesCommitsToTheRepository))(
    'never cancels a run of %s, which pushes commits to the repository',
    (fileName) => {
      const cancelInProgress =
        readWorkflowConcurrency(fileName)['cancel-in-progress'];
      expect(
        cancelInProgress === undefined || cancelInProgress === false,
      ).toBe(true);
    },
  );
});
