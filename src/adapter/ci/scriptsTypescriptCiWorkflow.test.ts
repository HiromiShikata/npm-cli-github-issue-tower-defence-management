import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const workflowFilePath = path.join(
  repositoryRoot,
  '.github',
  'workflows',
  'scripts-typescript-ci.yml',
);
const changedSinceTestCommand = 'jest --changedSince';
const unusedSecretEnvironmentVariableName = 'GH_TOKEN';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readWorkflow = (): Record<string, unknown> => {
  const workflow: unknown = parse(fs.readFileSync(workflowFilePath, 'utf8'));
  if (!isRecord(workflow)) {
    throw new Error(
      `${workflowFilePath} does not parse to a workflow mapping`,
    );
  }
  return workflow;
};

const workflowJobs = (): Record<string, unknown>[] => {
  const jobs = readWorkflow()['jobs'];
  if (!isRecord(jobs)) {
    throw new Error(`${workflowFilePath} does not declare a jobs mapping`);
  }
  return Object.values(jobs).filter(isRecord);
};

const jobSteps = (job: Record<string, unknown>): Record<string, unknown>[] => {
  const steps = job['steps'];
  return Array.isArray(steps) ? steps.filter(isRecord) : [];
};

const stepRunCommand = (step: Record<string, unknown>): string => {
  const run = step['run'];
  return typeof run === 'string' ? run : '';
};

const stepEnvironmentKeys = (step: Record<string, unknown>): string[] => {
  const environment = step['env'];
  if (!isRecord(environment)) {
    return [];
  }
  return Object.keys(environment);
};

const changedSinceTestStep = (): Record<string, unknown> => {
  const step = workflowJobs()
    .flatMap((job) => jobSteps(job))
    .find((candidate) =>
      stepRunCommand(candidate).includes(changedSinceTestCommand),
    );
  if (step === undefined) {
    throw new Error(
      `${workflowFilePath} does not declare a step running ${changedSinceTestCommand}`,
    );
  }
  return step;
};

describe('scripts/typescript CI workflow', () => {
  it('does not pass GH_TOKEN to the changed-since-base test step, because no scripts/typescript test reads it', () => {
    expect(stepEnvironmentKeys(changedSinceTestStep())).not.toContain(
      unusedSecretEnvironmentVariableName,
    );
  });
});
