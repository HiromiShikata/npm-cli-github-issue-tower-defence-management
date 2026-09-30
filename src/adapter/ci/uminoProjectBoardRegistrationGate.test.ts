import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import {
  evaluateGitHubActionsExpression,
  GitHubActionsContextValue,
} from './githubActionsExpressionEvaluator';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const workflowDirectory = path.join(repositoryRoot, '.github', 'workflows');
const uminoProjectWorkflowFileName = 'umino-project.yml';
const uminoJobId = 'umino-job';
const boardRegistrationRunCommandSubstring = 'addProjectV2ItemById';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readWorkflow = (fileName: string): Record<string, unknown> => {
  const workflow: unknown = parse(
    fs.readFileSync(path.resolve(workflowDirectory, fileName), 'utf8'),
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

const boardRegistrationStepCondition = (): string => {
  const jobs = workflowJobs(uminoProjectWorkflowFileName);
  const job = jobs.get(uminoJobId);
  if (job === undefined) {
    throw new Error(
      `${uminoProjectWorkflowFileName} does not declare job ${uminoJobId}`,
    );
  }
  const step = jobSteps(job).find((candidate) =>
    stepRunCommand(candidate).includes(boardRegistrationRunCommandSubstring),
  );
  if (step === undefined) {
    throw new Error(
      `job ${uminoJobId} in ${uminoProjectWorkflowFileName} declares no step whose run script includes ${boardRegistrationRunCommandSubstring}`,
    );
  }
  const condition = stepCondition(step);
  if (condition.length === 0) {
    throw new Error(
      `the ${boardRegistrationRunCommandSubstring} step in job ${uminoJobId} of ${uminoProjectWorkflowFileName} declares no if condition`,
    );
  }
  return condition;
};

const expression = boardRegistrationStepCondition();

describe('umino-project board registration gate', () => {
  it('extracts a non-empty if condition from the real workflow file', () => {
    expect(expression.length).toBeGreaterThan(0);
  });

  it.each<[string, Record<string, GitHubActionsContextValue>, boolean]>([
    [
      'registers on the board when an issue is newly opened',
      {
        github: {
          event_name: 'issues',
          event: { action: 'opened', issue: { state: 'open' } },
        },
      },
      true,
    ],
    [
      'registers on the board when a closed issue is reopened',
      {
        github: {
          event_name: 'issues',
          event: { action: 'reopened', issue: { state: 'open' } },
        },
      },
      true,
    ],
    [
      'does not register when an issue is only labeled',
      {
        github: {
          event_name: 'issues',
          event: { action: 'labeled', issue: { state: 'open' } },
        },
      },
      false,
    ],
    [
      'does not register when the issue payload reports itself closed at open time',
      {
        github: {
          event_name: 'issues',
          event: { action: 'opened', issue: { state: 'closed' } },
        },
      },
      false,
    ],
    [
      'does not register when a pull request is opened',
      {
        github: {
          event_name: 'pull_request',
          event: { action: 'opened' },
        },
      },
      false,
    ],
    [
      'does not register when a pull request is synchronized',
      {
        github: {
          event_name: 'pull_request',
          event: { action: 'synchronize' },
        },
      },
      false,
    ],
  ])('%s', (_scenario, context, expected) => {
    expect(evaluateGitHubActionsExpression(expression, context)).toBe(expected);
  });
});

describe('evaluateGitHubActionsExpression', () => {
  const roleAndStatusContext: Record<string, GitHubActionsContextValue> = {
    config: { role: 'admin', status: 'enabled' },
  };
  const precedenceContext: Record<string, GitHubActionsContextValue> = {
    config: { role: 'guest', status: 'enabled', tier: 'gold' },
  };

  it.each<[string, string, Record<string, GitHubActionsContextValue>, boolean]>(
    [
      [
        'evaluates a matching equality comparison as true',
        "config.role == 'admin'",
        roleAndStatusContext,
        true,
      ],
      [
        'evaluates a non-matching equality comparison as false',
        "config.role == 'viewer'",
        roleAndStatusContext,
        false,
      ],
      [
        'requires both sides of && to hold',
        "config.role == 'admin' && config.status == 'enabled'",
        roleAndStatusContext,
        true,
      ],
      [
        'requires only one side of || to hold',
        "config.role == 'viewer' || config.status == 'enabled'",
        roleAndStatusContext,
        true,
      ],
      [
        'resolves a missing nested property to false for == rather than throwing',
        "config.owner.name == 'someone'",
        roleAndStatusContext,
        false,
      ],
      [
        'evaluates && before || when no parentheses are present',
        "config.role == 'admin' && config.status == 'enabled' || config.tier == 'gold'",
        precedenceContext,
        true,
      ],
      [
        'lets parentheses override the default && before || precedence',
        "config.role == 'admin' && (config.status == 'enabled' || config.tier == 'gold')",
        precedenceContext,
        false,
      ],
    ],
  )('%s', (_description, candidateExpression, context, expected) => {
    expect(evaluateGitHubActionsExpression(candidateExpression, context)).toBe(
      expected,
    );
  });
});
