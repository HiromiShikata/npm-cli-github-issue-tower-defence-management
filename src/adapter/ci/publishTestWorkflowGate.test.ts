import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const workflowDirectory = path.join(repositoryRoot, '.github', 'workflows');
const publishWorkflowFileName = 'publish.yml';
const gateJobId = 'verify-test-workflow-conclusion';
const gateScriptRelativePath = './scripts/testWorkflowRunVerify.sh';
const gateScriptAbsolutePath = path.join(
  repositoryRoot,
  'scripts',
  'testWorkflowRunVerify.sh',
);
const tipScriptRelativePath = './scripts/defaultBranchTipVerify.sh';
const tipScriptAbsolutePath = path.join(
  repositoryRoot,
  'scripts',
  'defaultBranchTipVerify.sh',
);
const tipStepId = 'default-branch-tip';
const releasableCondition = `steps.${tipStepId}.outputs.releasable == 'true'`;
const releaseCommand = 'npx semantic-release';
const repositoryPushCommand = 'git push origin';
const testSuiteCommand = 'npm run test';
const ambiguousTestJobId = 'test';
const pushedCommitExpression = '${{ github.sha }}';
const pushedRefExpression = '${{ github.ref }}';
const defaultBranchExpression = '${{ github.event.repository.default_branch }}';
const writePermissionValue = 'write';
const shellScriptGlob = '*.sh';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readWorkflow = (fileName: string): Record<string, unknown> => {
  const workflow: unknown = parse(
    fs.readFileSync(path.join(workflowDirectory, fileName), 'utf8'),
  );
  if (!isRecord(workflow)) {
    throw new Error(`${fileName} does not parse to a workflow mapping`);
  }
  return workflow;
};

const workflowJobs = (
  fileName: string,
): Map<string, Record<string, unknown>> => {
  const jobs = readWorkflow(fileName)['jobs'];
  if (!isRecord(jobs)) {
    throw new Error(`${fileName} does not declare a jobs mapping`);
  }
  const declaredJobs = new Map<string, Record<string, unknown>>();
  for (const [jobId, job] of Object.entries(jobs)) {
    if (!isRecord(job)) {
      throw new Error(`${fileName} declares job ${jobId} as a non-mapping`);
    }
    declaredJobs.set(jobId, job);
  }
  return declaredJobs;
};

const publishWorkflowJobs = (): Map<string, Record<string, unknown>> =>
  workflowJobs(publishWorkflowFileName);

const jobById = (
  jobs: Map<string, Record<string, unknown>>,
  jobId: string,
): Record<string, unknown> => {
  const job = jobs.get(jobId);
  if (job === undefined) {
    throw new Error(`${publishWorkflowFileName} does not declare job ${jobId}`);
  }
  return job;
};

const jobSteps = (job: Record<string, unknown>): Record<string, unknown>[] => {
  const steps = job['steps'];
  return Array.isArray(steps) ? steps.filter(isRecord) : [];
};

const stepRunCommand = (step: Record<string, unknown>): string => {
  const run = step['run'];
  return typeof run === 'string' ? run : '';
};

const stepCondition = (step: Record<string, unknown>): string => {
  const condition = step['if'];
  return typeof condition === 'string' ? condition : '';
};

const stepEnvironment = (
  step: Record<string, unknown>,
): Map<string, string> => {
  const environment = step['env'];
  const declared = new Map<string, string>();
  if (!isRecord(environment)) {
    return declared;
  }
  for (const [name, value] of Object.entries(environment)) {
    declared.set(
      name,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }
  return declared;
};

const jobNeeds = (job: Record<string, unknown>): string[] => {
  const needs = job['needs'];
  if (typeof needs === 'string') {
    return [needs];
  }
  return Array.isArray(needs)
    ? needs.filter((need): need is string => typeof need === 'string')
    : [];
};

const transitiveJobDependencies = (
  jobs: Map<string, Record<string, unknown>>,
  jobId: string,
): Set<string> => {
  const dependencies = new Set<string>();
  const unvisited = jobNeeds(jobById(jobs, jobId));
  while (unvisited.length > 0) {
    const dependency = unvisited.pop();
    if (dependency === undefined || dependencies.has(dependency)) {
      continue;
    }
    dependencies.add(dependency);
    unvisited.push(...jobNeeds(jobById(jobs, dependency)));
  }
  return dependencies;
};

const jobIdsRunningCommand = (
  jobs: Map<string, Record<string, unknown>>,
  command: string,
): string[] =>
  [...jobs.entries()]
    .filter(([, job]) =>
      jobSteps(job).some((step) => stepRunCommand(step).includes(command)),
    )
    .map(([jobId]) => jobId);

const gateVerificationStep = (): Record<string, unknown> => {
  const step = jobSteps(jobById(publishWorkflowJobs(), gateJobId)).find(
    (candidate) => stepRunCommand(candidate).includes(gateScriptRelativePath),
  );
  if (step === undefined) {
    throw new Error(`job ${gateJobId} does not run ${gateScriptRelativePath}`);
  }
  return step;
};

const gateEnvironmentValue = (name: string): string => {
  const value = stepEnvironment(gateVerificationStep()).get(name);
  if (value === undefined) {
    throw new Error(`the gate step does not declare ${name}`);
  }
  return value;
};

const prettierIgnorePatterns = (): string[] =>
  fs
    .readFileSync(path.join(repositoryRoot, '.prettierignore'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const workflowFileNames = (): string[] =>
  fs
    .readdirSync(workflowDirectory)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();

const workflowFileNamesRunningTheTestSuite = (): string[] =>
  workflowFileNames().filter(
    (fileName) =>
      jobIdsRunningCommand(workflowJobs(fileName), testSuiteCommand).length > 0,
  );

const workflowFileNamesDeclaringJob = (jobId: string): string[] =>
  workflowFileNames().filter((fileName) => workflowJobs(fileName).has(jobId));

const publishWorkflowStepsRunning = (
  command: string,
): Record<string, unknown>[] =>
  [...publishWorkflowJobs().values()].flatMap((job) =>
    jobSteps(job).filter((step) => stepRunCommand(step).includes(command)),
  );

const releaseJobId = (): string => {
  const releasingJobIds = jobIdsRunningCommand(
    publishWorkflowJobs(),
    releaseCommand,
  );
  if (releasingJobIds.length !== 1) {
    throw new Error(
      `${publishWorkflowFileName} declares ${releasingJobIds.length} jobs running ${releaseCommand}`,
    );
  }
  return releasingJobIds.join('');
};

const jobConcurrency = (jobId: string): Record<string, unknown> => {
  const concurrency = jobById(publishWorkflowJobs(), jobId)['concurrency'];
  if (!isRecord(concurrency)) {
    throw new Error(
      `${publishWorkflowFileName} job ${jobId} declares no concurrency mapping`,
    );
  }
  return concurrency;
};

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

describe('publish workflow release gate wiring', () => {
  it('makes every job that cuts a release depend on the test conclusion gate', () => {
    const jobs = publishWorkflowJobs();
    const releasingJobIds = jobIdsRunningCommand(jobs, releaseCommand);
    expect(releasingJobIds.length).toBeGreaterThan(0);
    for (const releasingJobId of releasingJobIds) {
      expect([...transitiveJobDependencies(jobs, releasingJobId)]).toContain(
        gateJobId,
      );
    }
  });

  it('verifies the test conclusion of the pushed commit rather than of a branch or a ref', () => {
    expect(gateEnvironmentValue('VERIFIED_COMMIT_SHA')).toBe(
      pushedCommitExpression,
    );
  });

  it('verifies the workflow file that actually runs the repository test suite', () => {
    expect(workflowFileNamesRunningTheTestSuite()).toEqual([
      gateEnvironmentValue('TEST_WORKFLOW_FILE'),
    ]);
  });

  it('identifies the test suite by workflow file, which more than one workflow declaring a job of the same name cannot impersonate', () => {
    const fileNamesDeclaringTheAmbiguousJob =
      workflowFileNamesDeclaringJob(ambiguousTestJobId);
    expect(fileNamesDeclaringTheAmbiguousJob.length).toBeGreaterThan(1);
    const verifiedWorkflowFileName = gateEnvironmentValue('TEST_WORKFLOW_FILE');
    expect(workflowFileNames()).toContain(verifiedWorkflowFileName);
    for (const fileName of fileNamesDeclaringTheAmbiguousJob.filter(
      (candidate) => candidate !== verifiedWorkflowFileName,
    )) {
      expect(
        jobIdsRunningCommand(workflowJobs(fileName), testSuiteCommand),
      ).toEqual([]);
    }
  });

  it('accepts only a successful test conclusion as releasable', () => {
    expect(gateEnvironmentValue('REQUIRED_CONCLUSION')).toBe('success');
  });

  it('bounds the time it waits for the test conclusion', () => {
    expect(
      Number(gateEnvironmentValue('POLL_TIMEOUT_SECONDS')),
    ).toBeGreaterThan(0);
    expect(
      Number(gateEnvironmentValue('POLL_INTERVAL_SECONDS')),
    ).toBeGreaterThan(0);
  });

  it('resolves the default branch tip inside the release job, after the build and before the release', () => {
    const steps = jobSteps(jobById(publishWorkflowJobs(), releaseJobId()));
    const tipStepIndex = steps.findIndex((step) =>
      stepRunCommand(step).includes(tipScriptRelativePath),
    );
    const releaseStepIndex = steps.findIndex((step) =>
      stepRunCommand(step).includes(releaseCommand),
    );
    expect(tipStepIndex).toBeGreaterThan(-1);
    expect(releaseStepIndex).toBeGreaterThan(tipStepIndex);
    expect(steps[tipStepIndex]?.['id']).toBe(tipStepId);
  });

  it('resolves the default branch tip of the repository default branch rather than of a hardcoded branch', () => {
    const tipStep = jobSteps(
      jobById(publishWorkflowJobs(), releaseJobId()),
    ).find((step) => stepRunCommand(step).includes(tipScriptRelativePath));
    expect(tipStep).toBeDefined();
    if (tipStep === undefined) {
      return;
    }
    expect(stepEnvironment(tipStep).get('DEFAULT_BRANCH')).toBe(
      defaultBranchExpression,
    );
    expect(stepEnvironment(tipStep).get('VERIFIED_COMMIT_SHA')).toBe(
      pushedCommitExpression,
    );
  });

  it.each([releaseCommand, repositoryPushCommand])(
    'runs %s only while the triggering commit is still the default branch tip',
    (command) => {
      const steps = publishWorkflowStepsRunning(command);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(stepCondition(step)).toContain(releasableCondition);
      }
    },
  );

  it('serialises release execution and never cancels a release already in progress', () => {
    const concurrency = jobConcurrency(releaseJobId());
    expect(concurrency['group']).toBe(`publish-release-${pushedRefExpression}`);
    expect(concurrency['cancel-in-progress']).toBe(false);
  });

  it('excludes the gate shell scripts from the repository formatter, which cannot infer a parser for them', () => {
    expect(prettierIgnorePatterns()).toContain(shellScriptGlob);
  });

  it('keeps the release credentials out of the gate job', () => {
    expect(readWorkflow(publishWorkflowFileName)['env']).toBeUndefined();
    const gatePermissions = jobById(publishWorkflowJobs(), gateJobId)[
      'permissions'
    ];
    expect(isRecord(gatePermissions)).toBe(true);
    if (!isRecord(gatePermissions)) {
      return;
    }
    expect(Object.values(gatePermissions)).not.toContain(writePermissionValue);
  });
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
