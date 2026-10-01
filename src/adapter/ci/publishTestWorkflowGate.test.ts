import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const gateScriptAbsolutePath = path.join(
  repositoryRoot,
  'scripts',
  'testWorkflowRunVerify.sh',
);
const tipScriptAbsolutePath = path.join(
  repositoryRoot,
  'scripts',
  'defaultBranchTipVerify.sh',
);

type WorkflowRunFixture = {
  readonly id: number;
  readonly run_started_at: string;
  readonly status: string;
  readonly conclusion: string | null;
};

type GateScriptResult = {
  readonly exitStatus: number | null;
  readonly output: string;
  readonly requests: string[];
};

const fakeGitHubCliSource = `#!/usr/bin/env bash
set -euo pipefail
requestLine=$(printf '%s ' "$@" | tr '\\n' ' ')
printf '%s\\n' "\${requestLine}" >> "\${FAKE_GH_DIRECTORY}/requests.log"
callIndex=$(cat "\${FAKE_GH_DIRECTORY}/call-index")
echo $((callIndex + 1)) > "\${FAKE_GH_DIRECTORY}/call-index"
responseFile="\${FAKE_GH_DIRECTORY}/response-\${callIndex}.json"
if [ ! -f "\${responseFile}" ]; then
  echo "no fake response prepared for call \${callIndex}" >&2
  exit 70
fi
filter=""
while [ "$#" -gt 0 ]; do
  case "$1" in
  --jq)
    filter="$2"
    shift 2
    ;;
  *)
    shift
    ;;
  esac
done
jq -r "\${filter}" < "\${responseFile}"
`;

const runGateScript = (options: {
  readonly workflowRunsPerCall: readonly (readonly WorkflowRunFixture[])[];
  readonly pollTimeoutSeconds: number;
  readonly commitSha: string;
}): GateScriptResult => {
  const fakeDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'publish-test-workflow-gate-'),
  );
  const fakeGitHubCliPath = path.join(fakeDirectory, 'gh');
  fs.writeFileSync(fakeGitHubCliPath, fakeGitHubCliSource, { mode: 0o755 });
  fs.writeFileSync(path.join(fakeDirectory, 'call-index'), '1\n');
  fs.writeFileSync(path.join(fakeDirectory, 'requests.log'), '');
  options.workflowRunsPerCall.forEach((workflowRuns, callOffset) => {
    fs.writeFileSync(
      path.join(fakeDirectory, `response-${callOffset + 1}.json`),
      JSON.stringify({ workflow_runs: workflowRuns }),
    );
  });

  const completed = spawnSync(gateScriptAbsolutePath, [], {
    encoding: 'utf8',
    env: {
      PATH: `${fakeDirectory}:${process.env['PATH'] ?? ''}`,
      FAKE_GH_DIRECTORY: fakeDirectory,
      GITHUB_REPOSITORY:
        'HiromiShikata/npm-cli-github-issue-tower-defence-management',
      TEST_WORKFLOW_FILE: 'test.yml',
      VERIFIED_COMMIT_SHA: options.commitSha,
      REQUIRED_CONCLUSION: 'success',
      POLL_INTERVAL_SECONDS: '0',
      POLL_TIMEOUT_SECONDS: String(options.pollTimeoutSeconds),
    },
  });

  return {
    exitStatus: completed.status,
    output: `${completed.stdout}${completed.stderr}`,
    requests: fs
      .readFileSync(path.join(fakeDirectory, 'requests.log'), 'utf8')
      .split('\n')
      .filter((line) => line.length > 0),
  };
};

type TipScriptResult = {
  readonly exitStatus: number | null;
  readonly output: string;
  readonly stepOutputs: string[];
  readonly requests: string[];
};

const fakeGitSource = `#!/usr/bin/env bash
set -euo pipefail
requestLine=$(printf '%s ' "$@")
printf '%s\\n' "\${requestLine}" >> "\${FAKE_GIT_DIRECTORY}/requests.log"
cat "\${FAKE_GIT_DIRECTORY}/ls-remote-output"
`;

const runDefaultBranchTipScript = (options: {
  readonly defaultBranchTipSha: string;
  readonly verifiedCommitSha: string;
}): TipScriptResult => {
  const fakeDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'publish-default-branch-tip-'),
  );
  fs.writeFileSync(path.join(fakeDirectory, 'git'), fakeGitSource, {
    mode: 0o755,
  });
  fs.writeFileSync(path.join(fakeDirectory, 'requests.log'), '');
  fs.writeFileSync(
    path.join(fakeDirectory, 'ls-remote-output'),
    options.defaultBranchTipSha.length > 0
      ? `${options.defaultBranchTipSha}\trefs/heads/main\n`
      : '',
  );
  const stepOutputPath = path.join(fakeDirectory, 'step-output');
  fs.writeFileSync(stepOutputPath, '');

  const completed = spawnSync(tipScriptAbsolutePath, [], {
    encoding: 'utf8',
    env: {
      PATH: `${fakeDirectory}:${process.env['PATH'] ?? ''}`,
      FAKE_GIT_DIRECTORY: fakeDirectory,
      GITHUB_OUTPUT: stepOutputPath,
      DEFAULT_BRANCH: 'main',
      VERIFIED_COMMIT_SHA: options.verifiedCommitSha,
    },
  });

  const readLines = (filePath: string): string[] =>
    fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .filter((line) => line.length > 0);

  return {
    exitStatus: completed.status,
    output: `${completed.stdout}${completed.stderr}`,
    stepOutputs: readLines(stepOutputPath),
    requests: readLines(path.join(fakeDirectory, 'requests.log')),
  };
};

const workflowRun = (
  overrides: Partial<WorkflowRunFixture>,
): WorkflowRunFixture => ({
  id: 1,
  run_started_at: '2026-07-29T09:28:29Z',
  status: 'completed',
  conclusion: 'success',
  ...overrides,
});

describe('test workflow run verification script', () => {
  it('is executable so the publish workflow can invoke it directly', () => {
    expect(fs.statSync(gateScriptAbsolutePath).mode & 0o111).not.toBe(0);
  });

  it('asks the GitHub API for the test workflow runs of the verified commit only', () => {
    const commitSha = '4f188f506ee020addfc91e60a9df22fb77c2225f';
    const result = runGateScript({
      workflowRunsPerCall: [[workflowRun({})]],
      pollTimeoutSeconds: 0,
      commitSha,
    });
    expect(result.exitStatus).toBe(0);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toContain('actions/workflows/test.yml/runs');
    expect(result.requests[0]).toContain(`head_sha=${commitSha}`);
  });

  it('releases when the test run of the commit concluded success', () => {
    expect(
      runGateScript({
        workflowRunsPerCall: [[workflowRun({})]],
        pollTimeoutSeconds: 0,
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }).exitStatus,
    ).toBe(0);
  });

  it.each(['cancelled', 'failure', 'timed_out'])(
    'refuses to release when the test run of the commit concluded %s',
    (conclusion) => {
      const result = runGateScript({
        workflowRunsPerCall: [[workflowRun({ conclusion })]],
        pollTimeoutSeconds: 0,
        commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain(conclusion);
    },
  );

  it('refuses to release when no test run exists for the commit', () => {
    const result = runGateScript({
      workflowRunsPerCall: [[]],
      pollTimeoutSeconds: 0,
      commitSha: 'cccccccccccccccccccccccccccccccccccccccc',
    });
    expect(result.exitStatus).toBe(1);
    expect(result.output).toContain('absent');
  });

  it('refuses to release when the test run of the commit never concludes', () => {
    const result = runGateScript({
      workflowRunsPerCall: [
        [workflowRun({ status: 'in_progress', conclusion: null })],
      ],
      pollTimeoutSeconds: 0,
      commitSha: 'dddddddddddddddddddddddddddddddddddddddd',
    });
    expect(result.exitStatus).toBe(1);
    expect(result.output).toContain('pending');
  });

  it('waits for a running test run and releases once it concludes success', () => {
    const result = runGateScript({
      workflowRunsPerCall: [
        [workflowRun({ status: 'in_progress', conclusion: null })],
        [workflowRun({})],
      ],
      pollTimeoutSeconds: 120,
      commitSha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    });
    expect(result.exitStatus).toBe(0);
    expect(result.requests).toHaveLength(2);
  });

  it('refuses to release when the most recent test run of the commit was cancelled after an earlier success', () => {
    const result = runGateScript({
      workflowRunsPerCall: [
        [
          workflowRun({
            id: 1,
            run_started_at: '2026-07-29T09:28:29Z',
            conclusion: 'success',
          }),
          workflowRun({
            id: 2,
            run_started_at: '2026-07-29T09:29:27Z',
            conclusion: 'cancelled',
          }),
        ],
      ],
      pollTimeoutSeconds: 0,
      commitSha: 'ffffffffffffffffffffffffffffffffffffffff',
    });
    expect(result.exitStatus).toBe(1);
    expect(result.output).toContain('cancelled');
  });

  it('releases when the most recent test run of the commit succeeded after an earlier cancellation', () => {
    expect(
      runGateScript({
        workflowRunsPerCall: [
          [
            workflowRun({
              id: 1,
              run_started_at: '2026-07-29T09:28:29Z',
              conclusion: 'cancelled',
            }),
            workflowRun({
              id: 2,
              run_started_at: '2026-07-29T09:29:27Z',
              conclusion: 'success',
            }),
          ],
        ],
        pollTimeoutSeconds: 0,
        commitSha: '1111111111111111111111111111111111111111',
      }).exitStatus,
    ).toBe(0);
  });
});

describe('default branch tip verification script', () => {
  const tipSha = '2b5253004b28f5c1c5e5c2a9e0dd7d4a1b6cbb31';
  const olderSha = '4f188f506ee020addfc91e60a9df22fb77c2225f';

  it('is executable so the publish workflow can invoke it directly', () => {
    expect(fs.statSync(tipScriptAbsolutePath).mode & 0o111).not.toBe(0);
  });

  it('reads the tip of the default branch from the remote', () => {
    const result = runDefaultBranchTipScript({
      defaultBranchTipSha: tipSha,
      verifiedCommitSha: tipSha,
    });
    expect(result.requests).toEqual(['ls-remote origin refs/heads/main ']);
  });

  it('allows the release when the triggering commit is still the default branch tip', () => {
    const result = runDefaultBranchTipScript({
      defaultBranchTipSha: tipSha,
      verifiedCommitSha: tipSha,
    });
    expect(result.exitStatus).toBe(0);
    expect(result.stepOutputs).toContain('releasable=true');
  });

  it('withholds the release from a commit that a newer commit has replaced as the default branch tip', () => {
    const result = runDefaultBranchTipScript({
      defaultBranchTipSha: tipSha,
      verifiedCommitSha: olderSha,
    });
    expect(result.exitStatus).toBe(0);
    expect(result.stepOutputs).toContain('releasable=false');
    expect(result.stepOutputs).not.toContain('releasable=true');
    expect(result.output).toContain(olderSha);
    expect(result.output).toContain(tipSha);
  });

  it('fails rather than releasing when the default branch tip cannot be resolved', () => {
    const result = runDefaultBranchTipScript({
      defaultBranchTipSha: '',
      verifiedCommitSha: olderSha,
    });
    expect(result.exitStatus).toBe(1);
    expect(result.stepOutputs).toEqual([]);
  });
});
