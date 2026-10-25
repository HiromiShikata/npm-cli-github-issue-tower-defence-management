import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkStoryGate, StoryGateCommandOutput } from './storyGateCommands';

const ISSUE_URL = 'https://github.com/o/r/issues/1';
const TOKEN = 'test-token';
const GRAPHQL_URL = 'https://api.github.com/graphql';
const MAIN_ISSUE_API_URL = 'https://api.github.com/repos/o/r/issues/1';
const MAIN_ISSUE_COMMENTS_API_PATH = '/repos/o/r/issues/1/comments';
const CANDIDATE_ISSUE_API_URL = 'https://api.github.com/repos/o/r/issues/2';
const MAIN_ISSUE_BODY = 'Main issue. Parent: https://github.com/o/r/issues/2';
const PRIMARY_RATE_LIMIT_RESET_AT = '2026-10-26T07:33:20.000Z';
const CALL_WINDOW_RESET_AT = 'resetAt within the call window';
const SECONDARY_RATE_LIMIT_MESSAGE =
  'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.';
const UNCHANGED_NON_RATE_LIMIT_STDOUT =
  '{"schemaVersion":1,"issueUrl":"https://github.com/o/r/issues/1","dryRun":false,"action":"PROCEED","reason":"NOT_ON_ANY_BOARD","story":{"value":null,"source":"NONE","adoptedFromUrls":[]},"storyAdoption":{"outcome":"NOT_ATTEMPTED"},"routingJson":null,"specificationMissingRoutingJson":{"nextStepAgent":"spec-agent","returnToAgent":"developer-agent"},"activeStoryOptions":[],"storyIssues":[],"assignedIssue":{"url":"https://github.com/o/r/issues/1","state":"OPEN","hasStoryLabel":false,"commentCountTotal":0,"commentCountAfterLatestFold":0,"foldMode":null,"commentFiles":null},"specification":{"candidates":[{"url":"https://github.com/o/r/issues/1","source":"SELF","hasNumberedRequirements":false,"hasNumberedCriteria":false}],"unreadableUrls":["https://github.com/o/r/issues/2"],"detectedUrl":null},"facts":{"boardCacheFilePath":null,"boardCacheModifiedAt":null,"liveStoryRead":true,"liveProjectIds":[],"projectConfigFilePath":null,"agentInProjectAgents":null,"openClosingPullRequestUrls":[],"mergedClosingPullRequestUrls":[],"parentCandidateUrls":["https://github.com/o/r/issues/2"],"parentHasApprovedSpecification":false,"storyIssueUrlsNotFound":[]}}';

type FetchMock = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type RateLimitExpectation = {
  exitCode: 3;
  stdout: null;
  stderrLineCount: 2;
  lastStderrLineIsCanonicalJson: true;
  lastStderrLine: { rateLimited: true; resetAt: string };
};

type Expectation =
  RateLimitExpectation | { exitCode: 0; stdout: string; stderr: null };

type Row = {
  name: string;
  mock: FetchMock;
  expect: Expectation;
};

type CallWindow = { before: number; after: number };

const rateLimitedExpectationOf = (resetAt: string): RateLimitExpectation => ({
  exitCode: 3,
  stdout: null,
  stderrLineCount: 2,
  lastStderrLineIsCanonicalJson: true,
  lastStderrLine: { rateLimited: true, resetAt },
});

const jsonResponse = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const urlOf = (input: string | URL | Request): string =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

const graphqlOperationOf = (init: RequestInit | undefined): string | null => {
  if (typeof init?.body !== 'string') {
    return null;
  }
  const parsed: unknown = JSON.parse(init.body);
  const query =
    typeof parsed === 'object' && parsed !== null && 'query' in parsed
      ? parsed.query
      : undefined;
  return typeof query === 'string'
    ? (query.match(/^(?:query|mutation)\s+(\w+)/)?.[1] ?? null)
    : null;
};

const mainIssueResponseOf = (
  url: string,
  init: RequestInit | undefined,
): Response => {
  const operation = url === GRAPHQL_URL ? graphqlOperationOf(init) : null;
  if (operation === 'StoryGateIssueProjectItems') {
    return jsonResponse(
      {
        data: {
          repository: {
            issueOrPullRequest: {
              state: 'OPEN',
              projectItems: { nodes: [] },
            },
          },
        },
      },
      200,
    );
  }
  if (operation === 'StoryGateClosingPullRequests') {
    return jsonResponse(
      {
        data: {
          repository: {
            issueOrPullRequest: { timelineItems: { nodes: [] } },
          },
        },
      },
      200,
    );
  }
  if (url === MAIN_ISSUE_API_URL) {
    return jsonResponse(
      { state: 'open', body: MAIN_ISSUE_BODY, labels: [] },
      200,
    );
  }
  if (new URL(url).pathname === MAIN_ISSUE_COMMENTS_API_PATH) {
    return jsonResponse([], 200);
  }
  return jsonResponse({ message: `Unexpected request: ${url}` }, 400);
};

const candidateReadFetchOf =
  (candidateResponseOf: () => Response): FetchMock =>
  async (input, init) => {
    const url = urlOf(input);
    return url === CANDIDATE_ISSUE_API_URL
      ? candidateResponseOf()
      : mainIssueResponseOf(url, init);
  };

const ROWS: Row[] = [
  {
    name: 'candidate-parent read: primary rate limit',
    mock: candidateReadFetchOf(() =>
      jsonResponse({ message: 'API rate limit exceeded for user.' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1793000000',
      }),
    ),
    expect: rateLimitedExpectationOf(PRIMARY_RATE_LIMIT_RESET_AT),
  },
  {
    name: 'candidate-parent read: secondary rate limit as HTTP 429',
    mock: candidateReadFetchOf(() =>
      jsonResponse({ message: SECONDARY_RATE_LIMIT_MESSAGE }, 429, {
        'retry-after': '0',
      }),
    ),
    expect: rateLimitedExpectationOf(CALL_WINDOW_RESET_AT),
  },
  {
    name: 'candidate-parent read: non-rate-limit HTTP 403 (pinned)',
    mock: candidateReadFetchOf(() =>
      jsonResponse({ message: 'Resource not accessible by integration' }, 403, {
        'x-ratelimit-remaining': '4999',
      }),
    ),
    expect: {
      exitCode: 0,
      stdout: UNCHANGED_NON_RATE_LIMIT_STDOUT,
      stderr: null,
    },
  },
];

const parsedOrRawOf = (line: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(line);
    return parsed;
  } catch {
    return line;
  }
};

const isRecordLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isWithinCallWindow = (
  isoTimestamp: string,
  window: CallWindow,
): boolean => {
  const milliseconds = Date.parse(isoTimestamp);
  return milliseconds >= window.before && milliseconds <= window.after;
};

const expectedResetAtOf = (expect: Expectation): string | null =>
  expect.exitCode === 3 ? expect.lastStderrLine.resetAt : null;

const resetAtObservedOf = (
  resetAt: string,
  expectedResetAt: string | null,
  window: CallWindow,
): string =>
  expectedResetAt === CALL_WINDOW_RESET_AT &&
  isWithinCallWindow(resetAt, window)
    ? CALL_WINDOW_RESET_AT
    : resetAt;

const observedOf = (
  row: Row,
  output: StoryGateCommandOutput,
  window: CallWindow,
): object => {
  const exitCode: number = output.exitCode;
  if (exitCode !== 3) {
    return {
      name: row.name,
      exitCode,
      stdout: output.stdout,
      stderr: output.stderr,
    };
  }
  const lines = (output.stderr ?? '').split('\n');
  const lastLine = lines[lines.length - 1];
  const parsed = parsedOrRawOf(lastLine);
  const expectedResetAt = expectedResetAtOf(row.expect);
  return {
    name: row.name,
    exitCode,
    stdout: output.stdout,
    stderrLineCount: lines.length,
    lastStderrLineIsCanonicalJson: lastLine === JSON.stringify(parsed),
    lastStderrLine:
      isRecordLike(parsed) && typeof parsed.resetAt === 'string'
        ? {
            ...parsed,
            resetAt: resetAtObservedOf(parsed.resetAt, expectedResetAt, window),
          }
        : parsed,
  };
};

describe('storyGateCommands candidate-parent read GitHub rate limit exit code', () => {
  let workDirectory: string;
  let cacheDirectory: string;
  let configDirectory: string;
  let outputDirectory: string;

  beforeEach(() => {
    workDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'story-gate-candidate-rate-limit-'),
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

  const runCheckStoryGate = (): Promise<StoryGateCommandOutput> =>
    checkStoryGate({
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

  it('exits 3 with a rate limit line when the candidate-parent read is rate limited and keeps the non-rate-limit 403 output unchanged', async () => {
    const observed: object[] = [];
    for (const row of ROWS) {
      jest.spyOn(global, 'fetch').mockImplementation(row.mock);
      const before = Date.now();
      const output = await runCheckStoryGate();
      const after = Date.now();
      observed.push(observedOf(row, output, { before, after }));
    }
    expect(observed).toEqual(
      ROWS.map((row) => ({ name: row.name, ...row.expect })),
    );
  });
});
