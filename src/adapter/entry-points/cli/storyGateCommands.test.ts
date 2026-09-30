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

const ORG = 'example-org';
const GRAPHQL_URL = 'https://api.github.com/graphql';
const STORY_FIELD_ID = 'FIELD_story';
const AGENT_FIELD_ID = 'FIELD_agent';
const STATUS_FIELD_ID = 'FIELD_status';
const BOARD_PROJECT_ID = 'PVT_board';
const RESULT_FILE_NAME = 'story-gate-result.json';

const issueUrl = (number: number): string =>
  `https://github.com/${ORG}/repo/issues/${number}`;

const issueApiUrl = (number: number): string =>
  `https://api.github.com/repos/${ORG}/repo/issues/${number}`;

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

type FakeProjectItem = {
  id: string;
  projectId: string;
  story: string | null;
  agent: string | null;
  status: string | null;
};

type FakeIssue = {
  number: number;
  state: 'open' | 'closed';
  body: string;
  labels: string[];
  comments: string[];
  projectItems: FakeProjectItem[];
  closingPullRequests: { url: string; state: string }[];
};

type RecordedRequest = { url: string; method: string; body: unknown };

type FakeGithubOptions = {
  failingUrl?: string;
  graphqlErrors?: boolean;
};

const fakeIssue = (
  number: number,
  overrides: Partial<FakeIssue> = {},
): FakeIssue => ({
  number,
  state: 'open',
  body: `Issue ${number}`,
  labels: [],
  comments: [],
  projectItems: [],
  closingPullRequests: [],
  ...overrides,
});

const projectItem = (
  number: number,
  story: string | null,
  projectId = BOARD_PROJECT_ID,
): FakeProjectItem => ({
  id: `ITEM_${number}`,
  projectId,
  story,
  agent: 'developer-agent',
  status: 'In Progress',
});

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

const selectValue = (name: string | null) => (name === null ? null : { name });

const projectItemNode = (item: FakeProjectItem) => ({
  id: item.id,
  project: {
    id: item.projectId,
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

const graphqlRespond = (issues: FakeIssue[], body: unknown): Response => {
  const query = isRecord(body) ? body.query : undefined;
  const variables = isRecord(body) ? body.variables : undefined;
  const issue = issues.find(
    (candidate) => isRecord(variables) && candidate.number === variables.number,
  );
  if (query === PROJECT_ITEM_SINGLE_SELECT_UPDATE_MUTATION) {
    mutationApply(issues, variables);
    return jsonResponse({
      data: {
        updateProjectV2ItemFieldValue: { projectV2Item: { id: 'ITEM' } },
      },
    });
  }
  if (query === ISSUE_PROJECT_ITEMS_QUERY) {
    return jsonResponse({
      data: {
        repository: {
          issueOrPullRequest:
            issue === undefined
              ? null
              : {
                  state: issue.state.toUpperCase(),
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
          issueOrPullRequest: {
            timelineItems: {
              nodes: (issue?.closingPullRequests ?? []).map((pullRequest) => ({
                willCloseTarget: true,
                source: pullRequest,
              })),
            },
          },
        },
      },
    });
  }
  return jsonResponse({ errors: [{ message: 'Unknown query' }] }, 400);
};

const restRespond = (issues: FakeIssue[], url: string): Response => {
  const parsed = new URL(url);
  const match = parsed.pathname.match(
    /^\/repos\/example-org\/repo\/issues\/(\d+)(\/comments)?$/,
  );
  const issue = issues.find(
    (candidate) => match !== null && candidate.number === Number(match[1]),
  );
  if (match === null || issue === undefined) {
    return jsonResponse({ message: 'Not Found' }, 404);
  }
  if (match[2] === undefined) {
    return jsonResponse({
      state: issue.state,
      body: issue.body,
      labels: issue.labels.map((name) => ({ name })),
    });
  }
  const page = parsed.searchParams.get('page');
  return jsonResponse(
    page === null || page === '1'
      ? issue.comments.map((body, index) => ({
          html_url: `${issueUrl(issue.number)}#issuecomment-${index + 1}`,
          created_at: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
          body,
        }))
      : [],
  );
};

const fakeGithubInstall = (
  issues: FakeIssue[],
  options: FakeGithubOptions = {},
): RecordedRequest[] => {
  const requests: RecordedRequest[] = [];
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input, init): Promise<Response> => {
      const url = requestUrlOf(input);
      const rawBody = init?.body;
      const body: unknown =
        typeof rawBody === 'string' ? JSON.parse(rawBody) : null;
      requests.push({ url, method: init?.method ?? 'GET', body });
      if (url === options.failingUrl) {
        return jsonResponse({ message: 'Server Error' }, 500);
      }
      if (url === GRAPHQL_URL) {
        if (options.graphqlErrors === true) {
          return jsonResponse({
            data: null,
            errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible' }],
          });
        }
        return graphqlRespond(issues, body);
      }
      return restRespond(issues, url);
    });
  return requests;
};

const mutationRequestsOf = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) =>
      isRecord(request.body) &&
      typeof request.body.query === 'string' &&
      request.body.query.trimStart().startsWith('mutation'),
  );

const valueAt = (value: unknown, keys: (string | number)[]): unknown =>
  keys.reduce<unknown>((current, key) => {
    if (typeof key === 'number') {
      return Array.isArray(current) ? current[key] : undefined;
    }
    return isRecord(current) ? current[key] : undefined;
  }, value);

const stringAt = (value: unknown, keys: (string | number)[]): string => {
  const found = valueAt(value, keys);
  if (typeof found !== 'string') {
    throw new Error(`Expected a string at ${keys.join('.')}`);
  }
  return found;
};

const lastStdoutJson = (output: StoryGateCommandOutput): unknown => {
  const lines = (output.stdout ?? '').trim().split('\n');
  const parsed: unknown = JSON.parse(lines[lines.length - 1]);
  return parsed;
};

type BoardCacheIssueFixture = {
  number: number;
  story: string | null;
  body?: string;
  labels?: string[];
};

const boardCacheWrite = (
  baseDirectory: string,
  projectName: string,
  issues: BoardCacheIssueFixture[],
  modifiedAt: Date,
  storyIssueUrlByOptionName: Record<string, string> = {
    'feature A': issueUrl(100),
    'feature B': issueUrl(101),
  },
): void => {
  const directory = path.join(
    baseDirectory,
    projectName,
    `allIssues-${BOARD_PROJECT_ID}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, 'latest.json');
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      lastFetchedAt: '2026-09-01T00:00:00Z',
      lastFullFetchAt: '2026-09-01T00:00:00Z',
      project: {
        id: BOARD_PROJECT_ID,
        url: `https://github.com/orgs/${ORG}/projects/1`,
        databaseId: 1,
        name: 'Example board',
        status: {
          name: 'Status',
          fieldId: STATUS_FIELD_ID,
          statuses: STATUS_OPTIONS.map((option) => ({
            ...option,
            description: '',
          })),
        },
        story: {
          name: 'Story',
          fieldId: STORY_FIELD_ID,
          databaseId: 2,
          stories: STORY_OPTIONS.map((option) => ({
            ...option,
            description: '',
          })),
          workflowManagementStory: {
            id: 'OPT_regular',
            name: 'regular / chores',
          },
        },
      },
      issues: issues.map((issue) => ({
        nameWithOwner: `${ORG}/repo`,
        number: issue.number,
        title: `Issue ${issue.number}`,
        url: issueUrl(issue.number),
        story: issue.story,
        labels: issue.labels ?? [],
        body: issue.body ?? `Issue ${issue.number}`,
        itemId: `ITEM_${issue.number}`,
      })),
      storyIssueUrlByOptionName,
      storyOptions: [],
    }),
  );
  fs.utimesSync(filePath, modifiedAt, modifiedAt);
};

describe('storyGateCommands', () => {
  let workDirectory: string;
  let cacheDirectory: string;
  let configDirectory: string;
  let outputDirectory: string;

  beforeEach(() => {
    workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'story-gate-cli-'));
    cacheDirectory = path.join(workDirectory, 'cache');
    configDirectory = path.join(workDirectory, 'config');
    outputDirectory = path.join(workDirectory, 'output');
    fs.mkdirSync(cacheDirectory);
    fs.mkdirSync(configDirectory);
    fs.writeFileSync(
      path.join(configDirectory, 'example.config.yaml'),
      `org: ${ORG}\nagents:\n  - developer-agent\n  - triage-agent\n`,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(workDirectory, { recursive: true, force: true });
  });

  const resultFilePath = (): string =>
    path.join(outputDirectory, RESULT_FILE_NAME);

  const checkStoryGateRun = (
    overrides: {
      issueUrl?: string;
      ghToken?: string | undefined;
      dryRun?: boolean;
    } = {},
  ): Promise<StoryGateCommandOutput> =>
    checkStoryGate({
      issueUrl: overrides.issueUrl ?? issueUrl(1),
      agentName: 'developer-agent',
      triageAgentName: 'triage-agent',
      specificationAgentName: 'spec-agent',
      configDirectory,
      outputDirectory,
      dryRun: overrides.dryRun ?? false,
      ghToken: 'ghToken' in overrides ? overrides.ghToken : 'test-token',
      boardCacheBaseDirectory: cacheDirectory,
    });

  const commands: {
    name: string;
    run: (
      issueUrlValue: string,
      ghToken: string | undefined,
    ) => Promise<StoryGateCommandOutput>;
  }[] = [
    {
      name: 'checkStoryGate',
      run: (issueUrlValue, ghToken) =>
        checkStoryGateRun({ issueUrl: issueUrlValue, ghToken }),
    },
    {
      name: 'setIssueStoryIfUnset',
      run: (issueUrlValue, ghToken) =>
        setIssueStoryIfUnset({
          issueUrl: issueUrlValue,
          story: 'feature A',
          dryRun: false,
          ghToken,
        }),
    },
    {
      name: 'startSpecificationTask',
      run: (issueUrlValue, ghToken) =>
        startSpecificationTask({
          issueUrl: issueUrlValue,
          specificationAgentName: 'spec-agent',
          dryRun: false,
          ghToken,
        }),
    },
  ];

  const missingTokenCases = commands.flatMap((command) =>
    [undefined, ''].map((ghToken) => ({
      ...command,
      tokenLabel: ghToken === undefined ? 'unset' : 'empty',
      ghToken,
    })),
  );

  it.each(missingTokenCases)(
    '$name exits 2 without a result file when GH_TOKEN is $tokenLabel',
    async ({ run, ghToken }) => {
      const requests = fakeGithubInstall([fakeIssue(1)]);

      const output = await run(issueUrl(1), ghToken);

      expect(output.exitCode).toBe(2);
      expect(output.stdout).toBeNull();
      expect(output.stderr).toEqual(expect.stringMatching(/\S/));
      expect(requests).toEqual([]);
      expect(fs.existsSync(resultFilePath())).toBe(false);
    },
  );

  it.each(commands)(
    '$name exits 2 without any GitHub request for an invalid issue URL',
    async ({ run }) => {
      const requests = fakeGithubInstall([fakeIssue(1)]);

      const output = await run('https://example.com/not-an-issue', 'token');

      expect(output.exitCode).toBe(2);
      expect(output.stdout).toBeNull();
      expect(output.stderr).toEqual(expect.stringMatching(/\S/));
      expect(requests).toEqual([]);
      expect(fs.existsSync(resultFilePath())).toBe(false);
    },
  );

  it.each([
    { name: 'the issue read', failingUrl: issueApiUrl(1) },
    { name: 'the GraphQL request', failingUrl: GRAPHQL_URL },
  ])(
    'checkStoryGate exits 2 with the failing request and no result file when $name returns HTTP 500',
    async ({ failingUrl }) => {
      fakeGithubInstall(
        [fakeIssue(1, { projectItems: [projectItem(1, null)] })],
        { failingUrl },
      );

      const output = await checkStoryGateRun();

      expect(output.exitCode).toBe(2);
      expect(output.stdout).toBeNull();
      expect(output.stderr).toEqual(expect.stringContaining(failingUrl));
      expect(output.stderr).toEqual(expect.stringContaining('500'));
      expect(fs.existsSync(resultFilePath())).toBe(false);
    },
  );

  it('checkStoryGate exits 2 without a result file when GraphQL returns errors', async () => {
    fakeGithubInstall([fakeIssue(1)], { graphqlErrors: true });

    const output = await checkStoryGateRun();

    expect(output.exitCode).toBe(2);
    expect(output.stderr).toEqual(
      expect.stringContaining('Resource not accessible'),
    );
    expect(fs.existsSync(resultFilePath())).toBe(false);
  });

  it.each([
    {
      name: 'setIssueStoryIfUnset',
      run: () =>
        setIssueStoryIfUnset({
          issueUrl: issueUrl(1),
          story: 'feature A',
          dryRun: false,
          ghToken: 'test-token',
        }),
    },
    {
      name: 'startSpecificationTask',
      run: () =>
        startSpecificationTask({
          issueUrl: issueUrl(1),
          specificationAgentName: 'spec-agent',
          dryRun: false,
          ghToken: 'test-token',
        }),
    },
  ])(
    '$name exits 2 with the failing request when GraphQL returns HTTP 500',
    async ({ run }) => {
      fakeGithubInstall(
        [fakeIssue(1, { projectItems: [projectItem(1, null)] })],
        { failingUrl: GRAPHQL_URL },
      );

      const output = await run();

      expect(output.exitCode).toBe(2);
      expect(output.stdout).toBeNull();
      expect(output.stderr).toEqual(expect.stringContaining(GRAPHQL_URL));
    },
  );

  it('checkStoryGate writes the result file, prints the same JSON last and exits 0', async () => {
    fakeGithubInstall([fakeIssue(1)]);

    const output = await checkStoryGateRun();

    expect(output.exitCode).toBe(0);
    const printed = lastStdoutJson(output);
    const written: unknown = JSON.parse(
      fs.readFileSync(resultFilePath(), 'utf8'),
    );
    expect(written).toEqual(printed);
    expect(isRecord(written) ? Object.keys(written) : []).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'issueUrl',
        'dryRun',
        'action',
        'reason',
        'story',
        'storyAdoption',
        'routingJson',
        'specificationMissingRoutingJson',
        'activeStoryOptions',
        'storyIssues',
        'assignedIssue',
        'specification',
        'facts',
      ]),
    );
    expect(written).toMatchObject({
      schemaVersion: 1,
      issueUrl: issueUrl(1),
      dryRun: false,
      action: 'PROCEED',
      reason: 'NOT_ON_ANY_BOARD',
    });
  });

  it.each([
    { name: 'the first project directory', newest: 'alpha', stale: 'beta' },
    { name: 'the last project directory', newest: 'beta', stale: 'alpha' },
  ])(
    'checkStoryGate uses the newest board cache in $name and writes the story issue files',
    async ({ newest, stale }) => {
      boardCacheWrite(
        cacheDirectory,
        newest,
        [{ number: 1, story: 'feature A' }],
        new Date('2026-09-20T00:00:00Z'),
      );
      boardCacheWrite(
        cacheDirectory,
        stale,
        [{ number: 1, story: 'feature B' }],
        new Date('2026-09-01T00:00:00Z'),
      );
      fakeGithubInstall([
        fakeIssue(1, { projectItems: [projectItem(1, 'feature B')] }),
        fakeIssue(100, {
          body: 'story-issue-body-text',
          labels: ['story'],
          comments: [
            'owner-comment-text',
            'From: :robot: developer-agent (model)\nagent-comment-text',
          ],
        }),
        fakeIssue(101, { body: 'stale story issue', labels: ['story'] }),
      ]);

      const output = await checkStoryGateRun();

      expect(output.exitCode).toBe(0);
      const result = lastStdoutJson(output);
      expect(result).toMatchObject({
        action: 'PROCEED',
        reason: 'STORY_ISSUE_READ',
        story: { value: 'feature A', source: 'BOARD_CACHE' },
        storyIssues: [
          {
            url: issueUrl(100),
            state: 'OPEN',
            ownerCommentCount: 1,
            agentCommentCountRead: 1,
          },
        ],
      });
      const bodyPath = stringAt(result, ['storyIssues', 0, 'bodyPath']);
      const ownerPath = stringAt(result, [
        'storyIssues',
        0,
        'ownerCommentsPath',
      ]);
      const agentPath = stringAt(result, [
        'storyIssues',
        0,
        'agentCommentsPath',
      ]);
      [bodyPath, ownerPath, agentPath].forEach((filePath) => {
        expect(path.resolve(filePath).startsWith(`${outputDirectory}/`)).toBe(
          true,
        );
        expect(fs.existsSync(filePath)).toBe(true);
      });
      expect(fs.readFileSync(bodyPath, 'utf8')).toContain(
        'story-issue-body-text',
      );
      expect(fs.readFileSync(ownerPath, 'utf8')).toContain(
        'owner-comment-text',
      );
      expect(fs.readFileSync(agentPath, 'utf8')).toContain(
        'agent-comment-text',
      );
    },
  );

  it('setIssueStoryIfUnset writes the Story and prints WRITTEN with exit 0', async () => {
    const requests = fakeGithubInstall([
      fakeIssue(1, { projectItems: [projectItem(1, null)] }),
    ]);

    const output = await setIssueStoryIfUnset({
      issueUrl: issueUrl(1),
      story: 'feature A',
      dryRun: false,
      ghToken: 'test-token',
    });

    expect(output.exitCode).toBe(0);
    expect(lastStdoutJson(output)).toMatchObject({ outcome: 'WRITTEN' });
    expect(
      mutationRequestsOf(requests).map((request) =>
        valueAt(request.body, ['variables']),
      ),
    ).toEqual([
      {
        projectId: BOARD_PROJECT_ID,
        itemId: 'ITEM_1',
        fieldId: STORY_FIELD_ID,
        optionId: 'OPT_feature_a',
      },
    ]);
  });

  it('setIssueStoryIfUnset prints OPTION_NOT_ACTIVE with exit 0 for a GRAY option', async () => {
    const requests = fakeGithubInstall([
      fakeIssue(1, { projectItems: [projectItem(1, null)] }),
    ]);

    const output = await setIssueStoryIfUnset({
      issueUrl: issueUrl(1),
      story: 'retired story',
      dryRun: false,
      ghToken: 'test-token',
    });

    expect(output.exitCode).toBe(0);
    expect(lastStdoutJson(output)).toMatchObject({
      outcome: 'OPTION_NOT_ACTIVE',
    });
    expect(mutationRequestsOf(requests)).toEqual([]);
  });

  it('startSpecificationTask sets Agent and Status and prints STARTED with exit 0', async () => {
    const requests = fakeGithubInstall([
      fakeIssue(1, { projectItems: [projectItem(1, 'feature A')] }),
    ]);

    const output = await startSpecificationTask({
      issueUrl: issueUrl(1),
      specificationAgentName: 'spec-agent',
      dryRun: false,
      ghToken: 'test-token',
    });

    expect(output.exitCode).toBe(0);
    expect(lastStdoutJson(output)).toMatchObject({ outcome: 'STARTED' });
    expect(
      mutationRequestsOf(requests).map((request) =>
        valueAt(request.body, ['variables']),
      ),
    ).toEqual(
      expect.arrayContaining([
        {
          projectId: BOARD_PROJECT_ID,
          itemId: 'ITEM_1',
          fieldId: AGENT_FIELD_ID,
          optionId: 'OPT_agent_spec',
        },
        {
          projectId: BOARD_PROJECT_ID,
          itemId: 'ITEM_1',
          fieldId: STATUS_FIELD_ID,
          optionId: 'OPT_status_awaiting',
        },
      ]),
    );
  });

  it.each([
    {
      name: 'checkStoryGate',
      run: () => checkStoryGateRun({ dryRun: true }),
      expected: { storyAdoption: { outcome: 'SKIPPED_DRY_RUN' } },
    },
    {
      name: 'setIssueStoryIfUnset',
      run: () =>
        setIssueStoryIfUnset({
          issueUrl: issueUrl(1),
          story: 'feature A',
          dryRun: true,
          ghToken: 'test-token',
        }),
      expected: { outcome: 'SKIPPED_DRY_RUN' },
    },
    {
      name: 'startSpecificationTask',
      run: () =>
        startSpecificationTask({
          issueUrl: issueUrl(1),
          specificationAgentName: 'spec-agent',
          dryRun: true,
          ghToken: 'test-token',
        }),
      expected: { outcome: 'SKIPPED_DRY_RUN' },
    },
  ])(
    '$name sends no GraphQL mutation on a dry run',
    async ({ run, expected }) => {
      boardCacheWrite(
        cacheDirectory,
        'example',
        [
          {
            number: 1,
            story: null,
            body: `From: :robot: developer-agent (model)\n\nRelated task:\n- ${issueUrl(2)}`,
          },
          { number: 2, story: 'feature A' },
        ],
        new Date('2026-09-20T00:00:00Z'),
      );
      const requests = fakeGithubInstall([
        fakeIssue(1, {
          body: `From: :robot: developer-agent (model)\n\nRelated task:\n- ${issueUrl(2)}`,
          projectItems: [projectItem(1, null)],
        }),
        fakeIssue(2, { projectItems: [projectItem(2, 'feature A')] }),
        fakeIssue(100, { labels: ['story'] }),
      ]);

      const output = await run();

      expect(output.exitCode).toBe(0);
      expect(lastStdoutJson(output)).toMatchObject(expected);
      expect(requests.length).toBeGreaterThan(0);
      expect(mutationRequestsOf(requests)).toEqual([]);
    },
  );
});
