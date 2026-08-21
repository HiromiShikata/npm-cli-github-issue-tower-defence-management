import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'yaml';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const workflowDirectory = path.join(repositoryRoot, '.github', 'workflows');
const consoleUiWorkflowFileName = 'console-ui.yml';
const consoleUiJobId = 'console-ui';
const playwrightInstallStepName =
  'Install Playwright browsers (console UI E2E)';

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

const workflowJob = (
  workflow: Record<string, unknown>,
  jobId: string,
): Record<string, unknown> => {
  const jobs = workflow.jobs;
  if (!isRecord(jobs)) {
    throw new Error(`workflow does not declare a jobs mapping`);
  }
  const job = jobs[jobId];
  if (!isRecord(job)) {
    throw new Error(`workflow does not declare job ${jobId}`);
  }
  return job;
};

const consoleUiJob = (): Record<string, unknown> =>
  workflowJob(readWorkflow(consoleUiWorkflowFileName), consoleUiJobId);

describe('console-ui workflow timeout', () => {
  it('declares a job-level timeout-minutes so a stalled apt phase in Playwright browser installation cannot hold the check pending for hours', () => {
    const timeoutMinutes = consoleUiJob()['timeout-minutes'];
    expect(typeof timeoutMinutes).toBe('number');
    expect(Number(timeoutMinutes)).toBeGreaterThan(0);
    expect(Number(timeoutMinutes)).toBeLessThanOrEqual(60);
  });

  it('names the Playwright browser installation step so it is identifiable in run logs', () => {
    const steps = consoleUiJob().steps;
    if (!Array.isArray(steps)) {
      throw new Error('steps is not an array');
    }
    const playwrightInstallStep = steps
      .filter(isRecord)
      .find((step) => step.name === playwrightInstallStepName);
    expect(playwrightInstallStep).toBeDefined();
  });
});
