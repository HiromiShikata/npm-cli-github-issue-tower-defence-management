import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isRecord } from '../../../domain/usecases/isRecord';
import {
  CLOSING_PULL_REQUESTS_QUERY,
  ISSUE_PROJECT_ITEMS_QUERY,
  PROJECT_ITEM_SINGLE_SELECT_UPDATE_MUTATION,
} from '../../repositories/GithubStoryGateIssueRepository';
import {
  checkStoryGate,
  setIssueStoryIfUnset,
  startSpecificationTask,
  StoryGateCommandOutput,
} from './storyGateCommands';

const GRAPHQL_URL = 'https://api.github.com/graphql';
const BOARD_PROJECT_ID = 'PVT_board';
const STORY_FIELD_ID = 'FIELD_story';
const AGENT_FIELD_ID = 'FIELD_agent';
const STATUS_FIELD_ID = 'FIELD_status';
const DEFAULT_TOKEN = 'test-token';
const DUMMY_TOKEN_VALUES = [DEFAULT_TOKEN, 'token-a', 'token-b'];
const REST_ISSUE_PATH_PATTERN =
  /^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)(\/comments)?$/;

const STORY_OPTIONS = [
  { id: 'OPT_regular', name: 'regular / chores', color: 'BLUE' },
  { id: 'OPT_feature_a', name: 'feature A', color: 'GREEN' },
  { id: 'OPT_feature_b', name: 'feature B', color: 'RED' },
  { id: 'OPT_retired', name: 'retired story', color: 'GRAY' },
];
const AGENT_OPTIONS = [
  { id: 'OPT_agent_developer', name: 'developer-agent', color: 'BLUE' },
  { id: 'OPT_agent_spec', name: 'spec-agent', color: 'GREEN' },
];
const STATUS_OPTIONS = [
  { id: 'OPT_status_in_progress', name: 'In Progress', color: 'YELLOW' },
  { id: 'OPT_status_awaiting', name: 'Awaiting Workspace', color: 'BLUE' },
];

const issueUrlOf = (owner: string, repo: string, number: number): string =>
  `https://github.com/${owner}/${repo}/issues/${number}`;

const ISSUE_A_URL = issueUrlOf('org-a', 'repo-a', 1);
const PARENT_B_URL = issueUrlOf('org-b', 'repo-b', 2);

const consoleConfigContent = [
  "projectName: 'demo'",
  'consoleProjects:',
  "  pj-a: 'https://github.com/orgs/org-a/projects/1'",
  "  pj-b: 'https://github.com/orgs/org-b/projects/2'",
  'consoleGithubTokens:',
  "  pj-a: 'token-a'",
  "  pj-b: 'token-b'",
  '',
].join('\n');

const blankTokenConfigContent = [
  "projectName: 'demo'",
  'consoleProjects:',
  "  pj-a: 'https://github.com/orgs/org-a/projects/1'",
  'consoleGithubTokens:',
  "  pj-a: ''",
  '',
].join('\n');

type FakeProjectItem = {
  id: string;
  story: string | null;
  agent: string | null;
  status: string | null;
};

type FakeIssue = {
  owner: string;
  repo: string;
  number: number;
  body: string;
  projectItems: FakeProjectItem[];
};

type RecordedRequest = {
  url: string;
  authorization: string | null;
  body: unknown;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const requestUrlOf = (input: string | URL | Request): string =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

const projectItemOf = (id: string, story: string | null): FakeProjectItem => ({
  id,
  story,
  agent: 'developer-agent',
  status: 'In Progress',
});

const selectValue = (name: string | null) => (name === null ? null : { name });

const projectItemNode = (item: FakeProjectItem) => ({
  id: item.id,
  project: {
    id: BOARD_PROJECT_ID,
    upperStoryField: { id: STORY_FIELD_ID, options: STORY_OPTIONS },
    lowerStoryField: null,
    agentField: { id: AGENT_FIELD_ID, options: AGENT_OPTIONS },
    statusField: { id: STATUS_FIELD_ID, options: STATUS_OPTIONS },
  },
  upperStory: selectValue(item.story),
  lowerStory: null,
  agent: selectValue(item.agent),
  status: selectValue(item.status),
});

const optionNameOf = (
  options: { id: string; name: string }[],
  optionId: unknown,
): string | null =>
  options.find((option) => option.id === optionId)?.name ?? null;

const mutationApply = (issues: FakeIssue[], variables: unknown): void => {
  if (!isRecord(variables)) {
    return;
  }
  issues
    .flatMap((issue) => issue.projectItems)
    .filter((item) => item.id === variables.itemId)
    .forEach((item) => {
      if (variables.fieldId === STORY_FIELD_ID) {
        item.story = optionNameOf(STORY_OPTIONS, variables.optionId);
      }
      if (variables.fieldId === AGENT_FIELD_ID) {
        item.agent = optionNameOf(AGENT_OPTIONS, variables.optionId);
      }
      if (variables.fieldId === STATUS_FIELD_ID) {
        item.status = optionNameOf(STATUS_OPTIONS, variables.optionId);
      }
    });
};

const issueOfVariables = (
  issues: FakeIssue[],
  variables: unknown,
): FakeIssue | undefined =>
  issues.find(
    (candidate) =>
      isRecord(variables) &&
      candidate.owner === variables.owner &&
      candidate.repo === variables.repo &&
      candidate.number === variables.number,
  );

const graphqlRespond = (issues: FakeIssue[], body: unknown): Response => {
  const query = isRecord(body) ? body.query : undefined;
  const variables = isRecord(body) ? body.variables : undefined;
  if (query === PROJECT_ITEM_SINGLE_SELECT_UPDATE_MUTATION) {
    mutationApply(issues, variables);
    return jsonResponse({
      data: {
        updateProjectV2ItemFieldValue: { projectV2Item: { id: 'ITEM' } },
      },
    });
  }
  const issue = issueOfVariables(issues, variables);
  if (query === ISSUE_PROJECT_ITEMS_QUERY) {
    return jsonResponse({
      data: {
        repository: {
          issueOrPullRequest:
            issue === undefined
              ? null
              : {
                  state: 'OPEN',
                  projectItems: {
                    nodes: issue.projectItems.map(projectItemNode),
                  },
                },
        },
      },
    });
  }
  if (query === CLOSING_PULL_REQUESTS_QUERY) {
    return jsonResponse({
      data: {
        repository: {
          issueOrPullRequest: { timelineItems: { nodes: [] } },
        },
      },
    });
  }
  return jsonResponse({ errors: [{ message: 'Unknown query' }] }, 400);
};

const restRespond = (issues: FakeIssue[], url: string): Response => {
  const match = new URL(url).pathname.match(REST_ISSUE_PATH_PATTERN);
  const issue = issues.find(
    (candidate) =>
      match !== null &&
      candidate.owner === match[1] &&
      candidate.repo === match[2] &&
      candidate.number === Number(match[3]),
  );
  if (match === null || issue === undefined) {
    return jsonResponse({ message: 'Not Found' }, 404);
  }
  if (match[4] === undefined) {
    return jsonResponse({ state: 'open', body: issue.body, labels: [] });
  }
  return jsonResponse([]);
};

const fakeGithubInstall = (issues: FakeIssue[]): RecordedRequest[] => {
  const requests: RecordedRequest[] = [];
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input, init): Promise<Response> => {
      const url = requestUrlOf(input);
      const rawBody = init?.body;
      const body: unknown =
        typeof rawBody === 'string' ? JSON.parse(rawBody) : null;
      requests.push({
        url,
        authorization: new Headers(init?.headers).get('authorization'),
        body,
      });
      return url === GRAPHQL_URL
        ? graphqlRespond(issues, body)
        : restRespond(issues, url);
    });
  return requests;
};

const issueUrlOfRequest = (request: RecordedRequest): string | null => {
  const restMatch = new URL(request.url).pathname.match(
    REST_ISSUE_PATH_PATTERN,
  );
  if (restMatch !== null) {
    return issueUrlOf(restMatch[1], restMatch[2], Number(restMatch[3]));
  }
  const variables = isRecord(request.body) ? request.body.variables : undefined;
  if (
    isRecord(variables) &&
    typeof variables.owner === 'string' &&
    typeof variables.repo === 'string' &&
    typeof variables.number === 'number'
  ) {
    return issueUrlOf(variables.owner, variables.repo, variables.number);
  }
  return null;
};

const mutationRequestsOf = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) =>
      isRecord(request.body) &&
      typeof request.body.query === 'string' &&
      request.body.query.trimStart().startsWith('mutation'),
  );

const expectBlankTokenFailure = (output: StoryGateCommandOutput): void => {
  expect(output.exitCode).toBe(2);
  expect(output.stderr).toEqual(
    expect.stringContaining(
      'The GitHub token for pjcode "pj-a" is not configured',
    ),
  );
  const outputText = `${output.stdout ?? ''}\n${output.stderr ?? ''}`;
  expect(
    DUMMY_TOKEN_VALUES.filter((tokenValue) => outputText.includes(tokenValue)),
  ).toEqual([]);
};

describe('storyGateCommands per-owner GitHub token selection', () => {
  let workDirectory: string;
  let cacheDirectory: string;
  let configDirectory: string;
  let outputDirectory: string;

  beforeEach(() => {
    workDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'story-gate-token-selection-'),
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

  const writeConfigFile = (fileName: string, content: string): string => {
    const filePath = path.join(workDirectory, fileName);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  describe('checkStoryGate', () => {
    const runCheckStoryGate = (
      issueUrlValue: string,
      configFilePath: string,
    ): Promise<StoryGateCommandOutput> =>
      checkStoryGate({
        issueUrl: issueUrlValue,
        agentName: 'developer-agent',
        triageAgentName: 'triage-agent',
        specificationAgentName: 'spec-agent',
        configDirectory,
        outputDirectory,
        dryRun: false,
        ghToken: DEFAULT_TOKEN,
        boardCacheBaseDirectory: cacheDirectory,
        configFilePath,
      });

    it('sends the issue token for the issue and the parent token for its parent (criterion 1)', async () => {
      const requests = fakeGithubInstall([
        {
          owner: 'org-a',
          repo: 'repo-a',
          number: 1,
          body: `From: :robot: developer-agent (model)\n\nRelated task:\n- ${PARENT_B_URL}`,
          projectItems: [],
        },
        {
          owner: 'org-b',
          repo: 'repo-b',
          number: 2,
          body: 'Parent issue',
          projectItems: [],
        },
      ]);

      const output = await runCheckStoryGate(
        ISSUE_A_URL,
        writeConfigFile('console.yml', consoleConfigContent),
      );

      expect(output.exitCode).toBe(0);
      const expectedAuthorizationByUrl: Record<string, string> = {
        [ISSUE_A_URL]: 'Bearer token-a',
        [PARENT_B_URL]: 'Bearer token-b',
      };
      expect(
        requests.filter((request) => {
          const requestIssueUrl = issueUrlOfRequest(request);
          return (
            requestIssueUrl === null ||
            request.authorization !==
              expectedAuthorizationByUrl[requestIssueUrl]
          );
        }),
      ).toEqual([]);
      expect(requests.map((request) => issueUrlOfRequest(request))).toContain(
        PARENT_B_URL,
      );
    });

    it('exits 2 with the resolver error and no token value when the owner token is blank (criterion 7)', async () => {
      fakeGithubInstall([
        {
          owner: 'org-a',
          repo: 'repo-a',
          number: 1,
          body: 'Issue 1',
          projectItems: [],
        },
      ]);

      const output = await runCheckStoryGate(
        ISSUE_A_URL,
        writeConfigFile('blank-token.yml', blankTokenConfigContent),
      );

      expectBlankTokenFailure(output);
    });
  });

  describe('setIssueStoryIfUnset', () => {
    it('sends every request with the issue token (criterion 2)', async () => {
      const requests = fakeGithubInstall([
        {
          owner: 'org-a',
          repo: 'repo-a',
          number: 1,
          body: 'Issue 1',
          projectItems: [projectItemOf('ITEM_A1', null)],
        },
      ]);

      const output = await setIssueStoryIfUnset({
        issueUrl: ISSUE_A_URL,
        story: 'feature A',
        dryRun: false,
        ghToken: DEFAULT_TOKEN,
        configFilePath: writeConfigFile('console.yml', consoleConfigContent),
      });

      expect(output.exitCode).toBe(0);
      expect(mutationRequestsOf(requests)).toHaveLength(1);
      expect(requests.length).toBeGreaterThan(0);
      expect(
        requests.filter(
          (request) => request.authorization !== 'Bearer token-a',
        ),
      ).toEqual([]);
    });

    it('exits 2 with the resolver error and no token value when the owner token is blank (criterion 7)', async () => {
      fakeGithubInstall([
        {
          owner: 'org-a',
          repo: 'repo-a',
          number: 1,
          body: 'Issue 1',
          projectItems: [projectItemOf('ITEM_A1', null)],
        },
      ]);

      const output = await setIssueStoryIfUnset({
        issueUrl: ISSUE_A_URL,
        story: 'feature A',
        dryRun: false,
        ghToken: DEFAULT_TOKEN,
        configFilePath: writeConfigFile(
          'blank-token.yml',
          blankTokenConfigContent,
        ),
      });

      expectBlankTokenFailure(output);
    });
  });

  describe('startSpecificationTask', () => {
    it('sends every request with the issue token (criterion 3)', async () => {
      const requests = fakeGithubInstall([
        {
          owner: 'org-a',
          repo: 'repo-a',
          number: 1,
          body: 'Issue 1',
          projectItems: [projectItemOf('ITEM_A1', 'feature A')],
        },
      ]);

      const output = await startSpecificationTask({
        issueUrl: ISSUE_A_URL,
        specificationAgentName: 'spec-agent',
        dryRun: false,
        ghToken: DEFAULT_TOKEN,
        configFilePath: writeConfigFile('console.yml', consoleConfigContent),
      });

      expect(output.exitCode).toBe(0);
      expect(mutationRequestsOf(requests).length).toBeGreaterThan(0);
      expect(requests.length).toBeGreaterThan(0);
      expect(
        requests.filter(
          (request) => request.authorization !== 'Bearer token-a',
        ),
      ).toEqual([]);
    });

    it('exits 2 with the resolver error and no token value when the owner token is blank (criterion 7)', async () => {
      fakeGithubInstall([
        {
          owner: 'org-a',
          repo: 'repo-a',
          number: 1,
          body: 'Issue 1',
          projectItems: [projectItemOf('ITEM_A1', 'feature A')],
        },
      ]);

      const output = await startSpecificationTask({
        issueUrl: ISSUE_A_URL,
        specificationAgentName: 'spec-agent',
        dryRun: false,
        ghToken: DEFAULT_TOKEN,
        configFilePath: writeConfigFile(
          'blank-token.yml',
          blankTokenConfigContent,
        ),
      });

      expectBlankTokenFailure(output);
    });
  });
});
