import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isRecord } from '../../../domain/usecases/isRecord';
import {
  checkStoryGate,
  setIssueStoryIfUnset,
  startSpecificationTask,
  StoryGateCommandOutput,
} from './storyGateCommands';

const ISSUE_URL = 'https://github.com/o/r/issues/1';
const TOKEN = 'test-token';
const RATE_LIMIT_RESET_AT = '2026-10-26T07:33:20.000Z';
const CALL_WINDOW_RESET_AT = 'resetAt within the call window';
const SECONDARY_RATE_LIMIT_MESSAGE =
  'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.';

type CommandName =
  'checkStoryGate' | 'setIssueStoryIfUnset' | 'startSpecificationTask';

const COMMAND_NAMES: CommandName[] = [
  'checkStoryGate',
  'setIssueStoryIfUnset',
  'startSpecificationTask',
];

type HttpMock = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

type RateLimitLine = {
  rateLimited: true;
  resetAt: string | null;
};

type Expectation =
  | { exitCode: number; stdout: null; lastStderrLine: RateLimitLine }
  | { exitCode: number; stdout: null; stderr: string };

type Row = {
  name: string;
  command: CommandName;
  mock: HttpMock;
  expect: Expectation;
};

type CallWindow = { before: number; after: number };

const PRIMARY_RATE_LIMIT: HttpMock = {
  status: 403,
  headers: {
    'x-ratelimit-remaining': '0',
    'x-ratelimit-reset': '1793000000',
  },
  body: { message: 'API rate limit exceeded for user.' },
};

const SECONDARY_RATE_LIMIT_403: HttpMock = {
  status: 403,
  headers: { 'retry-after': '0' },
  body: { message: SECONDARY_RATE_LIMIT_MESSAGE },
};

const SECONDARY_RATE_LIMIT_429: HttpMock = {
  status: 429,
  headers: { 'retry-after': '0' },
  body: { message: SECONDARY_RATE_LIMIT_MESSAGE },
};

const GRAPHQL_RATE_LIMITED: HttpMock = {
  status: 200,
  headers: {},
  body: {
    errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
  },
};

const HTTP_UNAUTHORIZED: HttpMock = {
  status: 401,
  headers: {},
  body: { message: 'Bad credentials' },
};

const GRAPHQL_FORBIDDEN: HttpMock = {
  status: 200,
  headers: {},
  body: {
    errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible' }],
  },
};

const PINNED_HTTP_STDERR: Record<CommandName, string> = {
  checkStoryGate:
    'checkStoryGate failed for https://github.com/o/r/issues/1: POST https://api.github.com/graphql returned HTTP 401',
  setIssueStoryIfUnset:
    'setIssueStoryIfUnset failed for https://github.com/o/r/issues/1: POST https://api.github.com/graphql returned HTTP 401',
  startSpecificationTask:
    'startSpecificationTask failed for https://github.com/o/r/issues/1: POST https://api.github.com/graphql returned HTTP 401',
};

const PINNED_GRAPHQL_STDERR: Record<CommandName, string> = {
  checkStoryGate:
    'checkStoryGate failed for https://github.com/o/r/issues/1: POST https://api.github.com/graphql StoryGateIssueProjectItems {"owner":"o","repo":"r","number":1} returned errors: FORBIDDEN Resource not accessible',
  setIssueStoryIfUnset:
    'setIssueStoryIfUnset failed for https://github.com/o/r/issues/1: POST https://api.github.com/graphql StoryGateIssueProjectItems {"owner":"o","repo":"r","number":1} returned errors: FORBIDDEN Resource not accessible',
  startSpecificationTask:
    'startSpecificationTask failed for https://github.com/o/r/issues/1: POST https://api.github.com/graphql StoryGateIssueProjectItems {"owner":"o","repo":"r","number":1} returned errors: FORBIDDEN Resource not accessible',
};

const rateLimitedExpectation = (resetAt: string | null): Expectation => ({
  exitCode: 3,
  stdout: null,
  lastStderrLine: { rateLimited: true, resetAt },
});

const ROWS: Row[] = COMMAND_NAMES.flatMap((command) => [
  {
    name: `${command}: primary rate limit`,
    command,
    mock: PRIMARY_RATE_LIMIT,
    expect: rateLimitedExpectation(RATE_LIMIT_RESET_AT),
  },
  {
    name: `${command}: secondary rate limit as HTTP 403`,
    command,
    mock: SECONDARY_RATE_LIMIT_403,
    expect: rateLimitedExpectation(CALL_WINDOW_RESET_AT),
  },
  {
    name: `${command}: secondary rate limit as HTTP 429`,
    command,
    mock: SECONDARY_RATE_LIMIT_429,
    expect: rateLimitedExpectation(CALL_WINDOW_RESET_AT),
  },
  {
    name: `${command}: GraphQL RATE_LIMITED error`,
    command,
    mock: GRAPHQL_RATE_LIMITED,
    expect: rateLimitedExpectation(null),
  },
  {
    name: `${command}: non-rate-limit HTTP 401 (pinned)`,
    command,
    mock: HTTP_UNAUTHORIZED,
    expect: {
      exitCode: 2,
      stdout: null,
      stderr: PINNED_HTTP_STDERR[command],
    },
  },
  {
    name: `${command}: non-rate-limit GraphQL FORBIDDEN error (pinned)`,
    command,
    mock: GRAPHQL_FORBIDDEN,
    expect: {
      exitCode: 2,
      stdout: null,
      stderr: PINNED_GRAPHQL_STDERR[command],
    },
  },
]);

const responseOf = (mock: HttpMock): Response =>
  new Response(JSON.stringify(mock.body), {
    status: mock.status,
    headers: mock.headers,
  });

const lastLineOf = (stderr: string | null): string => {
  const lines = (stderr ?? '').split('\n');
  return lines[lines.length - 1];
};

const parsedJsonOf = (line: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(line);
    return parsed;
  } catch {
    return line;
  }
};

const rateLimitLineOf = (line: string, window: CallWindow): unknown => {
  const parsed = parsedJsonOf(line);
  if (!isRecord(parsed) || typeof parsed.resetAt !== 'string') {
    return parsed;
  }
  const resetAtMilliseconds = Date.parse(parsed.resetAt);
  return resetAtMilliseconds >= window.before &&
    resetAtMilliseconds <= window.after
    ? { ...parsed, resetAt: CALL_WINDOW_RESET_AT }
    : parsed;
};

const observedOf = (
  name: string,
  output: StoryGateCommandOutput,
  window: CallWindow,
): object => {
  const exitCode: number = output.exitCode;
  if (exitCode === 3) {
    return {
      name,
      exitCode,
      stdout: output.stdout,
      lastStderrLine: rateLimitLineOf(lastLineOf(output.stderr), window),
    };
  }
  return {
    name,
    exitCode,
    stdout: output.stdout,
    stderr: output.stderr,
  };
};

describe('storyGateCommands GitHub rate limit exit code', () => {
  let workDirectory: string;
  let cacheDirectory: string;
  let configDirectory: string;
  let outputDirectory: string;

  beforeEach(() => {
    workDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'story-gate-rate-limit-'),
    );
    cacheDirectory = path.join(workDirectory, 'cache');
    configDirectory = path.join(workDirectory, 'config');
    outputDirectory = path.join(workDirectory, 'output');
    fs.mkdirSync(cacheDirectory);
    fs.mkdirSync(configDirectory);
    fs.writeFileSync(
      path.join(configDirectory, 'example.config.yaml'),
      'org: org-a\nagents:\n  - developer-agent\n  - triage-agent\n',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(workDirectory, { recursive: true, force: true });
  });

  const runCommand = (
    command: CommandName,
  ): Promise<StoryGateCommandOutput> => {
    switch (command) {
      case 'checkStoryGate':
        return checkStoryGate({
          issueUrl: ISSUE_URL,
          agentName: 'developer-agent',
          triageAgentName: 'triage-agent',
          specificationAgentName: 'spec-agent',
          configDirectory,
          outputDirectory,
          dryRun: false,
          ghToken: TOKEN,
          boardCacheBaseDirectory: cacheDirectory,
        });
      case 'setIssueStoryIfUnset':
        return setIssueStoryIfUnset({
          issueUrl: ISSUE_URL,
          story: 'feature A',
          dryRun: false,
          ghToken: TOKEN,
        });
      case 'startSpecificationTask':
        return startSpecificationTask({
          issueUrl: ISSUE_URL,
          specificationAgentName: 'spec-agent',
          dryRun: false,
          ghToken: TOKEN,
        });
    }
  };

  it('exits 3 with a rate limit line for every GitHub rate limit response and exits 2 with the unchanged stderr for other failures', async () => {
    const observed: object[] = [];
    for (const row of ROWS) {
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(async () => responseOf(row.mock));
      const before = Date.now();
      const output = await runCommand(row.command);
      const after = Date.now();
      observed.push(observedOf(row.name, output, { before, after }));
    }
    expect(observed).toEqual(
      ROWS.map((row) => ({ name: row.name, ...row.expect })),
    );
  });
});
