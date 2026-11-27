import { mock } from 'jest-mock-extended';
import type { DateRepository } from '../../../domain/usecases/adapter-interfaces/DateRepository';
import type { ProjectRepository } from '../../../domain/usecases/adapter-interfaces/ProjectRepository';
import type { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import type { LocalStorageRepository } from '../LocalStorageRepository';
import { ApiV3CheerioRestIssueRepository } from './ApiV3CheerioRestIssueRepository';
import type { ApiV3IssueRepository } from './ApiV3IssueRepository';
import type { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import type { RestIssueRepository } from './RestIssueRepository';

type FetchRoute = Response | object;
type PullRequestState = 'OPEN' | 'CLOSED' | 'NOT_FOUND';
type StateByPullRequestNumber = Partial<Record<number, PullRequestState>>;
type FetchRoutes = {
  relatedOpenPullRequestUrlsBatch?: (
    variables: Record<string, unknown>,
  ) => FetchRoute;
  recordedCommentsPage?: () => FetchRoute;
  slimPullRequest?: (prNumber: number) => FetchRoute;
  slimPullRequestBatch?: (variables: Record<string, unknown>) => FetchRoute;
};
type RelatedIssueFixture = {
  timelineNodes?: unknown[];
  comments?: { body: string }[];
  commentsNextCursor?: string;
};

type FetchSpy = ReturnType<typeof mockFetchRoutes>;

const issueUrlAt = (index: number): string =>
  `https://github.com/test-owner/test-repository/issues/${100 + index}`;
const pullRequestUrl = (number: number): string =>
  `https://github.com/test-owner/test-repository/pull/${number}`;
const jsonResponse = (body: object): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const toResponse = (value: FetchRoute): Response =>
  value instanceof Response ? value : jsonResponse(value);
const requestUrlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
const requestBodyOf = (init?: RequestInit): string =>
  typeof init?.body === 'string' ? init.body : '';
const graphqlBodyOf = (
  init?: RequestInit,
): { query: string; variables: Record<string, unknown> } => {
  const body: unknown = JSON.parse(requestBodyOf(init));
  if (
    typeof body !== 'object' ||
    body === null ||
    !('query' in body) ||
    typeof body.query !== 'string'
  ) {
    throw new Error('Unexpected GraphQL request body');
  }
  const variables =
    'variables' in body &&
    typeof body.variables === 'object' &&
    body.variables !== null
      ? body.variables
      : {};
  return {
    query: body.query,
    variables: Object.fromEntries(Object.entries(variables)),
  };
};
const buildSlimPullRequestNode = (number: number, state = 'OPEN') => ({
  url: pullRequestUrl(number),
  state,
  isDraft: false,
  headRefName: `feature-${number}`,
  baseRefName: 'main',
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  headRefOid: `head-sha-${number}`,
  reviewDecision: null,
  reviewThreads: {
    pageInfo: { endCursor: null, hasNextPage: false },
    nodes: [],
  },
});
const buildSlimPullRequestResponse = (number: number, state = 'OPEN') => ({
  data: {
    repository: { pullRequest: buildSlimPullRequestNode(number, state) },
  },
});
const recordedComment = (number: number): { body: string } => ({
  body: `From: :robot: developer (model)\n\`\`\`json\n{"pullRequestUrl":"${pullRequestUrl(number)}"}\n\`\`\``,
});
const buildTimelineNode = (number: number, state = 'OPEN') => ({
  __typename: 'CrossReferencedEvent',
  willCloseTarget: true,
  source: {
    __typename: 'PullRequest',
    url: pullRequestUrl(number),
    number,
    body: null,
    state,
    createdAt: '2026-01-01T00:00:00.000Z',
    isDraft: false,
    mergeable: 'MERGEABLE',
    headRefName: `feature-${number}`,
    baseRefName: 'main',
    baseRef: { name: 'main' },
  },
});
const buildRelatedBatchResponse = (
  variables: Record<string, unknown>,
  issues: RelatedIssueFixture[],
) => ({
  data: Object.fromEntries(
    Object.keys(variables)
      .filter((key) => /^issueNumber\d+$/.test(key))
      .map((key) => {
        const fixture = issues[Number(variables[key]) - 100];
        if (fixture === undefined) {
          throw new Error(`No fixture for issue ${String(variables[key])}`);
        }
        return [
          `issue${key.slice('issueNumber'.length)}`,
          {
            issue: {
              comments: {
                nodes: fixture.comments ?? [],
                pageInfo:
                  fixture.commentsNextCursor === undefined
                    ? { endCursor: null, hasNextPage: false }
                    : {
                        endCursor: fixture.commentsNextCursor,
                        hasNextPage: true,
                      },
              },
              timelineItems: {
                nodes: fixture.timelineNodes ?? [],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          },
        ];
      }),
  ),
});
const buildRecordedCommentsPageResponse = (comments: { body: string }[]) => ({
  data: {
    repository: {
      issue: {
        comments: {
          nodes: comments,
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
  },
});
const buildSlimBatchResponseWithStates = (
  variables: Record<string, unknown>,
  states: StateByPullRequestNumber,
) => {
  const data: Record<string, unknown> = {};
  const errors: { message: string; type: string; path: string[] }[] = [];
  for (const key of Object.keys(variables).filter((candidate) =>
    /^prNumber\d+$/.test(candidate),
  )) {
    const alias = `pullRequest${key.slice('prNumber'.length)}`;
    const number = Number(variables[key]);
    const state = states[number] ?? 'OPEN';
    if (state === 'NOT_FOUND') {
      data[alias] = { pullRequest: null };
      errors.push({
        message: 'Could not resolve to a PullRequest',
        type: 'NOT_FOUND',
        path: [alias],
      });
    } else {
      data[alias] = { pullRequest: buildSlimPullRequestNode(number, state) };
    }
  }
  return errors.length > 0 ? { data, errors } : { data };
};
const buildSlimSingleResponse = (
  number: number,
  states: StateByPullRequestNumber,
): FetchRoute => {
  const state = states[number] ?? 'OPEN';
  return state === 'NOT_FOUND'
    ? { data: { repository: { pullRequest: null } } }
    : buildSlimPullRequestResponse(number, state);
};
const mockFetchRoutes = (routes: FetchRoutes) =>
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrlOf(input);
        if (url === 'https://api.github.com/graphql') {
          const body = graphqlBodyOf(init);
          if (
            body.query.includes('IssueRelatedOpenPullRequestUrlsBatch') &&
            routes.relatedOpenPullRequestUrlsBatch
          ) {
            return toResponse(
              routes.relatedOpenPullRequestUrlsBatch(body.variables),
            );
          }
          if (
            body.query.includes('IssueRecordedPullRequestComments') &&
            routes.recordedCommentsPage
          ) {
            return toResponse(routes.recordedCommentsPage());
          }
          if (
            body.query.includes('PullRequestSlimStatusBatch') &&
            routes.slimPullRequestBatch
          ) {
            return toResponse(routes.slimPullRequestBatch(body.variables));
          }
          if (body.query.includes('headRefOid') && routes.slimPullRequest) {
            const number =
              typeof body.variables.prNumber === 'number'
                ? body.variables.prNumber
                : 0;
            return toResponse(routes.slimPullRequest(number));
          }
          throw new Error(`Unexpected GraphQL query: ${body.query}`);
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
const countCallsMatching = (
  fetchSpy: FetchSpy,
  predicate: (body: string) => boolean,
): number =>
  fetchSpy.mock.calls.filter(([, init]) => predicate(requestBodyOf(init)))
    .length;
const countSingleQueries = (fetchSpy: FetchSpy): number =>
  countCallsMatching(
    fetchSpy,
    (body) =>
      body.includes('PullRequestSlimStatus') &&
      !body.includes('PullRequestSlimStatusBatch'),
  );
const countBatchQueries = (fetchSpy: FetchSpy): number =>
  countCallsMatching(fetchSpy, (body) =>
    body.includes('PullRequestSlimStatusBatch'),
  );
const countPullRequestNumberInBatchQueries = (
  fetchSpy: FetchSpy,
  prNumber: number,
): number =>
  fetchSpy.mock.calls.flatMap(([, init]) =>
    requestBodyOf(init).includes('PullRequestSlimStatusBatch')
      ? Object.entries(graphqlBodyOf(init).variables).filter(
          ([key, value]) => /^prNumber\d+$/.test(key) && value === prNumber,
        )
      : [],
  ).length;
const silenceConsole = () => ({
  info: jest.spyOn(console, 'info').mockImplementation(() => undefined),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => undefined),
});
const createRepository = (): ApiV3CheerioRestIssueRepository => {
  const apiV3IssueRepository = mock<ApiV3IssueRepository>();
  const restIssueRepository = mock<RestIssueRepository>();
  const graphqlProjectItemRepository = mock<GraphqlProjectItemRepository>();
  const localStorageCacheRepository = mock<LocalStorageCacheRepository>();
  localStorageCacheRepository.withLock.mockImplementation((_key, fn) => fn());
  const projectRepository = mock<ProjectRepository>();
  const dateRepository = mock<DateRepository>();
  dateRepository.now.mockResolvedValue(new Date('2026-01-01T00:00:00.000Z'));
  const localStorageRepository = mock<LocalStorageRepository>();
  return new ApiV3CheerioRestIssueRepository(
    apiV3IssueRepository,
    restIssueRepository,
    graphqlProjectItemRepository,
    localStorageCacheRepository,
    projectRepository,
    dateRepository,
    localStorageRepository,
    'dummy',
    jest.fn().mockResolvedValue(undefined),
  );
};

describe('ApiV3CheerioRestIssueRepository related open pull request URLs across issues', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns each issue its own open recorded pull request for two issues in one call', async () => {
    silenceConsole();
    mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: (variables) =>
        buildRelatedBatchResponse(variables, [
          { comments: [recordedComment(1)] },
          { comments: [recordedComment(2)] },
        ]),
      slimPullRequestBatch: (variables) =>
        buildSlimBatchResponseWithStates(variables, {}),
      slimPullRequest: (number) => buildSlimSingleResponse(number, {}),
    });

    const result = await createRepository().findRelatedOpenPrUrls([
      issueUrlAt(0),
      issueUrlAt(1),
    ]);

    expect(result).toEqual(
      new Map([
        [issueUrlAt(0), [pullRequestUrl(1)]],
        [issueUrlAt(1), [pullRequestUrl(2)]],
      ]),
    );
  });

  it('keeps each issue own open, closed, not-found and timeline related pull requests', async () => {
    type DistributionCase = {
      name: string;
      issues: { timeline: number[]; recorded: number[] }[];
      states: StateByPullRequestNumber;
      expected: number[][];
    };
    const cases: DistributionCase[] = [
      {
        name: 'keeps the open recorded pull request of each issue',
        issues: [
          { timeline: [], recorded: [1] },
          { timeline: [], recorded: [2] },
        ],
        states: {},
        expected: [[1], [2]],
      },
      {
        name: 'excludes a closed recorded pull request from its own issue only',
        issues: [
          { timeline: [], recorded: [1, 2] },
          { timeline: [], recorded: [3] },
        ],
        states: { 2: 'CLOSED' },
        expected: [[1], [3]],
      },
      {
        name: 'excludes a not found recorded pull request from its own issue only',
        issues: [
          { timeline: [], recorded: [1] },
          { timeline: [], recorded: [2, 3] },
        ],
        states: { 1: 'NOT_FOUND' },
        expected: [[], [2, 3]],
      },
      {
        name: 'lists timeline related pull requests before comment-recorded ones for the same issue',
        issues: [
          { timeline: [1], recorded: [2, 3] },
          { timeline: [], recorded: [4] },
        ],
        states: {},
        expected: [[1, 2, 3], [4]],
      },
    ];

    for (const testCase of cases) {
      silenceConsole();
      mockFetchRoutes({
        relatedOpenPullRequestUrlsBatch: (variables) =>
          buildRelatedBatchResponse(
            variables,
            testCase.issues.map((issue) => ({
              timelineNodes: issue.timeline.map((number) =>
                buildTimelineNode(number),
              ),
              comments: issue.recorded.map(recordedComment),
            })),
          ),
        slimPullRequestBatch: (variables) =>
          buildSlimBatchResponseWithStates(variables, testCase.states),
        slimPullRequest: (number) =>
          buildSlimSingleResponse(number, testCase.states),
      });

      const result = await createRepository().findRelatedOpenPrUrls(
        testCase.issues.map((_, index) => issueUrlAt(index)),
      );

      expect({
        name: testCase.name,
        actual: testCase.issues.map((_, index) =>
          result.get(issueUrlAt(index)),
        ),
      }).toEqual({
        name: testCase.name,
        actual: testCase.expected.map((numbers) => numbers.map(pullRequestUrl)),
      });
      jest.restoreAllMocks();
    }
  });

  it('distributes one hundred one recorded pull requests across two issues to their own issues', async () => {
    silenceConsole();
    const firstIssueNumbers = Array.from(
      { length: 60 },
      (_, index) => index + 1,
    );
    const secondIssueNumbers = Array.from(
      { length: 41 },
      (_, index) => index + 61,
    );
    mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: (variables) =>
        buildRelatedBatchResponse(variables, [
          { comments: firstIssueNumbers.map(recordedComment) },
          { comments: secondIssueNumbers.map(recordedComment) },
        ]),
      slimPullRequestBatch: (variables) =>
        buildSlimBatchResponseWithStates(variables, {}),
      slimPullRequest: (number) => buildSlimSingleResponse(number, {}),
    });

    const result = await createRepository().findRelatedOpenPrUrls([
      issueUrlAt(0),
      issueUrlAt(1),
    ]);

    expect(result).toEqual(
      new Map([
        [issueUrlAt(0), firstIssueNumbers.map(pullRequestUrl)],
        [issueUrlAt(1), secondIssueNumbers.map(pullRequestUrl)],
      ]),
    );
  });

  it('collects recorded pull requests from every comment page of an issue', async () => {
    silenceConsole();
    mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: (variables) =>
        buildRelatedBatchResponse(variables, [
          {
            comments: [recordedComment(1)],
            commentsNextCursor: 'cursor-1',
          },
          { comments: [recordedComment(3)] },
        ]),
      recordedCommentsPage: () =>
        buildRecordedCommentsPageResponse([recordedComment(2)]),
      slimPullRequestBatch: (variables) =>
        buildSlimBatchResponseWithStates(variables, {}),
      slimPullRequest: (number) => buildSlimSingleResponse(number, {}),
    });

    const result = await createRepository().findRelatedOpenPrUrls([
      issueUrlAt(0),
      issueUrlAt(1),
    ]);

    expect(result).toEqual(
      new Map([
        [issueUrlAt(0), [pullRequestUrl(1), pullRequestUrl(2)]],
        [issueUrlAt(1), [pullRequestUrl(3)]],
      ]),
    );
  });

  it('leaves only the issue whose comment page request fails unresolved and warns with its URL', async () => {
    const { warn } = silenceConsole();
    mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: (variables) =>
        buildRelatedBatchResponse(variables, [
          {
            comments: [recordedComment(1)],
            commentsNextCursor: 'cursor-1',
          },
          { comments: [recordedComment(3)] },
        ]),
      recordedCommentsPage: () => new Response('boom', { status: 500 }),
      slimPullRequestBatch: (variables) =>
        buildSlimBatchResponseWithStates(variables, {}),
      slimPullRequest: (number) => buildSlimSingleResponse(number, {}),
    });

    const result = await createRepository().findRelatedOpenPrUrls([
      issueUrlAt(0),
      issueUrlAt(1),
    ]);

    expect(result).toEqual(new Map([[issueUrlAt(1), [pullRequestUrl(3)]]]));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(issueUrlAt(0)));
  });

  it('resolves each issue per request and keeps its open pull requests when the batch status request fails', async () => {
    type BatchFailureCase = {
      name: string;
      batchResponse: () => FetchRoute;
    };
    const cases: BatchFailureCase[] = [
      {
        name: 'batch request returns an HTTP error',
        batchResponse: () => new Response('boom', { status: 500 }),
      },
      {
        name: 'batch response carries only GraphQL errors',
        batchResponse: () => ({
          errors: [{ message: 'boom', type: 'INTERNAL' }],
        }),
      },
    ];

    for (const testCase of cases) {
      const { info } = silenceConsole();
      const fetchSpy = mockFetchRoutes({
        relatedOpenPullRequestUrlsBatch: (variables) =>
          buildRelatedBatchResponse(variables, [
            { comments: [recordedComment(1)] },
            { comments: [recordedComment(2)] },
          ]),
        slimPullRequestBatch: testCase.batchResponse,
        slimPullRequest: (number) => buildSlimSingleResponse(number, {}),
      });

      const result = await createRepository().findRelatedOpenPrUrls([
        issueUrlAt(0),
        issueUrlAt(1),
      ]);

      expect({
        name: testCase.name,
        actual: [result.get(issueUrlAt(0)), result.get(issueUrlAt(1))],
        singleQueries: countSingleQueries(fetchSpy),
        fallbackLogged: info.mock.calls.some(([message]) =>
          String(message).includes('batched pull request status query failed'),
        ),
      }).toEqual({
        name: testCase.name,
        actual: [[pullRequestUrl(1)], [pullRequestUrl(2)]],
        singleQueries: 2,
        fallbackLogged: true,
      });
      jest.restoreAllMocks();
    }
  });

  it('leaves only the issue with a failing recorded pull request unresolved and keeps the other issue', async () => {
    const { warn } = silenceConsole();
    mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: (variables) =>
        buildRelatedBatchResponse(variables, [
          { comments: [recordedComment(1)] },
          { comments: [recordedComment(2)] },
        ]),
      slimPullRequestBatch: (variables) =>
        Object.values(variables).includes(1)
          ? new Response('boom', { status: 500 })
          : buildSlimBatchResponseWithStates(variables, {}),
      slimPullRequest: (number) =>
        number === 1
          ? new Response('boom', { status: 500 })
          : buildSlimSingleResponse(number, {}),
    });

    const result = await createRepository().findRelatedOpenPrUrls([
      issueUrlAt(0),
      issueUrlAt(1),
    ]);

    expect(result).toEqual(new Map([[issueUrlAt(1), [pullRequestUrl(2)]]]));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(pullRequestUrl(1)),
    );
  });
});

describe('ApiV3CheerioRestIssueRepository related open pull request URLs batched across issues', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends one pull request status batch for three issues with one open recorded pull request each', async () => {
    silenceConsole();
    const fetchSpy = mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: (variables) =>
        buildRelatedBatchResponse(variables, [
          { comments: [recordedComment(1)] },
          { comments: [recordedComment(2)] },
          { comments: [recordedComment(3)] },
        ]),
      slimPullRequestBatch: (variables) =>
        buildSlimBatchResponseWithStates(variables, {}),
      slimPullRequest: (number) => buildSlimSingleResponse(number, {}),
    });

    const result = await createRepository().findRelatedOpenPrUrls([
      issueUrlAt(0),
      issueUrlAt(1),
      issueUrlAt(2),
    ]);

    expect(countBatchQueries(fetchSpy)).toBe(1);
    expect(result).toEqual(
      new Map([
        [issueUrlAt(0), [pullRequestUrl(1)]],
        [issueUrlAt(1), [pullRequestUrl(2)]],
        [issueUrlAt(2), [pullRequestUrl(3)]],
      ]),
    );
  });

  it('sends two pull request status batches for one hundred one unique recorded pull requests across three issues', async () => {
    silenceConsole();
    const firstIssueNumbers = Array.from(
      { length: 50 },
      (_, index) => index + 1,
    );
    const secondIssueNumbers = Array.from(
      { length: 50 },
      (_, index) => index + 51,
    );
    const thirdIssueNumbers = [101];
    const fetchSpy = mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: (variables) =>
        buildRelatedBatchResponse(variables, [
          { comments: firstIssueNumbers.map(recordedComment) },
          { comments: secondIssueNumbers.map(recordedComment) },
          { comments: thirdIssueNumbers.map(recordedComment) },
        ]),
      slimPullRequestBatch: (variables) =>
        buildSlimBatchResponseWithStates(variables, {}),
      slimPullRequest: (number) => buildSlimSingleResponse(number, {}),
    });

    const result = await createRepository().findRelatedOpenPrUrls([
      issueUrlAt(0),
      issueUrlAt(1),
      issueUrlAt(2),
    ]);

    expect(countBatchQueries(fetchSpy)).toBe(2);
    expect(result).toEqual(
      new Map([
        [issueUrlAt(0), firstIssueNumbers.map(pullRequestUrl)],
        [issueUrlAt(1), secondIssueNumbers.map(pullRequestUrl)],
        [issueUrlAt(2), thirdIssueNumbers.map(pullRequestUrl)],
      ]),
    );
  });

  it('requests a pull request recorded by two issues once and returns it to both issues', async () => {
    silenceConsole();
    const fetchSpy = mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: (variables) =>
        buildRelatedBatchResponse(variables, [
          { comments: [recordedComment(1)] },
          { comments: [recordedComment(1)] },
        ]),
      slimPullRequestBatch: (variables) =>
        buildSlimBatchResponseWithStates(variables, {}),
      slimPullRequest: (number) => buildSlimSingleResponse(number, {}),
    });

    const result = await createRepository().findRelatedOpenPrUrls([
      issueUrlAt(0),
      issueUrlAt(1),
    ]);

    expect(countPullRequestNumberInBatchQueries(fetchSpy, 1)).toBe(1);
    expect(result).toEqual(
      new Map([
        [issueUrlAt(0), [pullRequestUrl(1)]],
        [issueUrlAt(1), [pullRequestUrl(1)]],
      ]),
    );
  });
});
