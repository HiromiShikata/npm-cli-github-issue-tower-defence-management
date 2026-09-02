import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const workflowPath = path.join(
  repositoryRoot,
  '.github',
  'workflows',
  'create-pr.yml',
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const extractEnableAutoMergeScript = (): string => {
  const workflow: unknown = parse(fs.readFileSync(workflowPath, 'utf8'));
  if (!isRecord(workflow)) {
    throw new Error('create-pr.yml does not parse to a workflow mapping');
  }
  const jobs = workflow['jobs'];
  if (!isRecord(jobs)) {
    throw new Error('create-pr.yml does not declare a jobs mapping');
  }
  const job = jobs['create_and_enable_automerge'];
  if (!isRecord(job)) {
    throw new Error(
      'create-pr.yml does not declare job create_and_enable_automerge',
    );
  }
  const steps = job['steps'];
  if (!Array.isArray(steps)) {
    throw new Error('create_and_enable_automerge job does not declare steps');
  }
  const step = steps
    .filter(isRecord)
    .find((s) => s['name'] === 'Enable Auto Merge for PR');
  if (step === undefined) {
    throw new Error(
      'create_and_enable_automerge job does not have an "Enable Auto Merge for PR" step',
    );
  }
  const run = step['run'];
  if (typeof run !== 'string') {
    throw new Error(
      '"Enable Auto Merge for PR" step does not have a run script',
    );
  }
  return run;
};

type ScriptResult = {
  readonly exitStatus: number | null;
  readonly output: string;
};

const runEnableAutoMergeScript = (options: {
  readonly curlResponse: string;
}): ScriptResult => {
  const fakeDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'enable-auto-merge-'),
  );
  const fakeCurlPath = path.join(fakeDirectory, 'curl');
  fs.writeFileSync(
    fakeCurlPath,
    `#!/usr/bin/env bash\necho "\${FAKE_CURL_RESPONSE}"\n`,
    { mode: 0o755 },
  );

  const rawScript = extractEnableAutoMergeScript();
  const script = rawScript.replace(/\$\{\{[^}]+\}\}/g, 'test-value');

  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      PATH: `${fakeDirectory}:${process.env['PATH'] ?? ''}`,
      FAKE_CURL_RESPONSE: options.curlResponse,
    },
  });

  return {
    exitStatus: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
};

describe('create PR workflow: enable auto merge step', () => {
  it('exits 0 when the GraphQL mutation succeeds without errors', () => {
    const result = runEnableAutoMergeScript({
      curlResponse: JSON.stringify({
        data: { enablePullRequestAutoMerge: { clientMutationId: null } },
      }),
    });
    expect(result.exitStatus).toBe(0);
    expect(result.output).toContain('Auto merge enabled successfully');
  });

  it('exits 0 with a warning when the PR is already in auto-merge state', () => {
    const result = runEnableAutoMergeScript({
      curlResponse: JSON.stringify({
        errors: [
          {
            type: 'UNPROCESSABLE',
            message: 'Pull request is already in auto-merge state',
          },
        ],
      }),
    });
    expect(result.exitStatus).toBe(0);
    expect(result.output).toContain('Warning');
  });

  it('exits 0 with a warning when the PR is in an unstable status', () => {
    const result = runEnableAutoMergeScript({
      curlResponse: JSON.stringify({
        errors: [
          {
            type: 'UNPROCESSABLE',
            message: 'Pull request is in an unstable status',
          },
        ],
      }),
    });
    expect(result.exitStatus).toBe(0);
    expect(result.output).toContain('Warning');
  });

  it('exits 0 with a warning when the GraphQL rate limit is exhausted', () => {
    const result = runEnableAutoMergeScript({
      curlResponse: JSON.stringify({
        errors: [
          {
            type: 'RATE_LIMIT',
            code: 'graphql_rate_limit',
            message: 'API rate limit already exceeded for user ID 6440811.',
          },
        ],
      }),
    });
    expect(result.exitStatus).toBe(0);
    expect(result.output).toContain('Warning');
  });

  it('exits 0 with a warning when auto-merge is blocked by required protected-branch checks', () => {
    const result = runEnableAutoMergeScript({
      curlResponse: JSON.stringify({
        errors: [
          {
            type: 'UNPROCESSABLE',
            message:
              'Required status checks must pass before merging into a protected branch',
          },
        ],
      }),
    });
    expect(result.exitStatus).toBe(0);
    expect(result.output).toContain('Warning');
  });

  it('exits 1 when an unrecognised GraphQL error is returned', () => {
    const result = runEnableAutoMergeScript({
      curlResponse: JSON.stringify({
        errors: [
          {
            type: 'FORBIDDEN',
            message: 'Resource not accessible by integration',
          },
        ],
      }),
    });
    expect(result.exitStatus).toBe(1);
    expect(result.output).toContain('Failed to enable auto merge');
  });
});
