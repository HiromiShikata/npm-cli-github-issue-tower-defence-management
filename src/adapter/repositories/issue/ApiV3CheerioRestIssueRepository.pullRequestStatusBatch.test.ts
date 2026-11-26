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
type FetchRoutes = {
  timeline?: () => FetchRoute;
  relatedOpenPullRequestUrlsBatch?: () => FetchRoute;
  slimPullRequest?: (prNumber: number) => FetchRoute;
  slimPullRequestBatch?: (variables: Record<string, unknown>) => FetchRoute;
  mergeability?: () => FetchRoute;
  branchRules?: () => FetchRoute;
  checkRuns?: () => FetchRoute;
  combinedStatus?: () => FetchRoute;
};

type FetchSpy = ReturnType<typeof mockFetchRoutes>;

const issueUrl = 'https://github.com/test-owner/test-repository/issues/100';
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
const buildTimelineNode = (
  number: number,
  state = 'OPEN',
  mergeable = 'MERGEABLE',
) => ({
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
    mergeable,
    headRefName: `feature-${number}`,
    baseRefName: 'main',
    baseRef: { name: 'main' },
  },
});
const buildIssueTimelineResponse = (
  nodes: unknown[],
  comments: { body: string }[] = [],
) => ({
  data: {
    repository: {
      issue: {
        comments: {
          nodes: comments,
          pageInfo: { endCursor: null, hasNextPage: false },
        },
        timelineItems: {
          nodes,
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
  },
});
const buildRecordedUrlsResponse = (comments: { body: string }[]) => ({
  data: {
    issue0: {
      issue: {
        comments: {
          nodes: comments,
          pageInfo: { endCursor: null, hasNextPage: false },
        },
        timelineItems: {
          nodes: [],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
  },
});
const buildBatchResponse = (variables: Record<string, unknown>) => ({
  data: Object.fromEntries(
    Object.keys(variables)
      .filter((key) => key.startsWith('prNumber'))
      .sort((left, right) => Number(left.slice(8)) - Number(right.slice(8)))
      .map((key) => {
        const index = key.slice(8);
        const number = Number(variables[key]);
        return [
          `pullRequest${index}`,
          { pullRequest: buildSlimPullRequestNode(number) },
        ];
      }),
  ),
});
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
            return toResponse(routes.relatedOpenPullRequestUrlsBatch());
          }
          if (body.query.includes('timelineItems') && routes.timeline) {
            return toResponse(routes.timeline());
          }
          if (
            body.query.includes('PullRequestSlimStatusBatch') &&
            routes.slimPullRequestBatch
          ) {
            return toResponse(routes.slimPullRequestBatch(body.variables));
          }
          if (body.query.includes('mergeStateStatus')) {
            return toResponse(
              routes.mergeability?.() ?? {
                data: {
                  repository: {
                    pullRequest: {
                      mergeable: 'MERGEABLE',
                      mergeStateStatus: 'CLEAN',
                    },
                  },
                },
              },
            );
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
        if (url.includes('/rules/branches/'))
          return toResponse(routes.branchRules?.() ?? []);
        if (/\/branches\/[^/?]+$/.test(url)) return toResponse({});
        if (/\/commits\/[^/]+\/check-runs/.test(url))
          return toResponse(
            routes.checkRuns?.() ?? { total_count: 0, check_runs: [] },
          );
        if (url.includes('/status?'))
          return toResponse(routes.combinedStatus?.() ?? { statuses: [] });
        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
const countCallsMatching = (
  fetchSpy: FetchSpy,
  predicate: (body: string) => boolean,
): number =>
  fetchSpy.mock.calls.filter(([, init]) => predicate(requestBodyOf(init)))
    .length;
const countBatchQueries = (fetchSpy: FetchSpy): number =>
  countCallsMatching(fetchSpy, (body) =>
    body.includes('PullRequestSlimStatusBatch'),
  );
const countSingleQueries = (fetchSpy: FetchSpy): number =>
  countCallsMatching(
    fetchSpy,
    (body) =>
      body.includes('PullRequestSlimStatus') &&
      !body.includes('PullRequestSlimStatusBatch'),
  );
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

describe('ApiV3CheerioRestIssueRepository pull request status batch migration', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns an open timeline related pull request with its current status fields', async () => {
    const fetchSpy = mockFetchRoutes({
      timeline: () =>
        buildIssueTimelineResponse([
          buildTimelineNode(1, 'OPEN', 'CONFLICTING'),
        ]),
      slimPullRequest: () => buildSlimPullRequestResponse(1),
      checkRuns: () => ({
        total_count: 1,
        check_runs: [{ id: 1, name: 'ci', conclusion: 'success' }],
      }),
    });
    const result = await createRepository().findRelatedOpenPRs(issueUrl);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      url: pullRequestUrl(1),
      branchName: 'feature-1',
      isConflicted: true,
      mergeable: 'CONFLICTING',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
    expect(countSingleQueries(fetchSpy)).toBe(1);
  });

  it('excludes a closed timeline related pull request', async () => {
    mockFetchRoutes({
      timeline: () =>
        buildIssueTimelineResponse([buildTimelineNode(1, 'CLOSED')]),
      slimPullRequest: () => buildSlimPullRequestResponse(1, 'CLOSED'),
    });
    await expect(
      createRepository().findRelatedOpenPRs(issueUrl),
    ).resolves.toEqual([]);
  });

  it('includes an open comment-recorded pull request and excludes a closed one', async () => {
    mockFetchRoutes({
      timeline: () =>
        buildIssueTimelineResponse(
          [],
          [recordedComment(1), recordedComment(2)],
        ),
      slimPullRequest: (number) =>
        buildSlimPullRequestResponse(number, number === 1 ? 'OPEN' : 'CLOSED'),
    });
    const result = await createRepository().findRelatedOpenPRs(issueUrl);
    expect(result.map((pr) => pr.url)).toEqual([pullRequestUrl(1)]);
  });

  it('skips one failed related pull request and still returns the other', async () => {
    mockFetchRoutes({
      timeline: () =>
        buildIssueTimelineResponse([
          buildTimelineNode(1),
          buildTimelineNode(2),
        ]),
      slimPullRequest: (number) =>
        number === 1
          ? new Response('boom', { status: 500 })
          : buildSlimPullRequestResponse(2),
      checkRuns: () => ({ total_count: 0, check_runs: [] }),
    });
    const result = await createRepository().findRelatedOpenPRs(issueUrl);
    expect(result.map((pr) => pr.url)).toEqual([pullRequestUrl(2)]);
  });

  it('returns recorded open pull request URLs in comment order', async () => {
    mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: () =>
        buildRecordedUrlsResponse([
          recordedComment(1),
          recordedComment(2),
          recordedComment(3),
        ]),
      slimPullRequest: (number) =>
        buildSlimPullRequestResponse(number, number === 2 ? 'CLOSED' : 'OPEN'),
    });
    const result = await createRepository().findRelatedOpenPrUrls([issueUrl]);
    expect(result.get(issueUrl)).toEqual([
      pullRequestUrl(1),
      pullRequestUrl(3),
    ]);
  });

  it('falls back to per-request resolution when the batch request fails', async () => {
    const infoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const numbers = [1, 2];
    const fetchSpy = mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: () =>
        buildRecordedUrlsResponse(numbers.map(recordedComment)),
      slimPullRequest: (number) => buildSlimPullRequestResponse(number),
      slimPullRequestBatch: () => new Response('boom', { status: 500 }),
    });

    const result = await createRepository().findRelatedOpenPrUrls([issueUrl]);

    expect(result.get(issueUrl)).toEqual(numbers.map(pullRequestUrl));
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('batched pull request status query failed'),
    );
    expect(countSingleQueries(fetchSpy)).toBe(2);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('excludes a recorded pull request reported as not found by the batch', async () => {
    const infoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fetchSpy = mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: () =>
        buildRecordedUrlsResponse([recordedComment(1), recordedComment(2)]),
      slimPullRequestBatch: () => ({
        data: {
          pullRequest0: { pullRequest: null },
          pullRequest1: { pullRequest: buildSlimPullRequestNode(2) },
        },
        errors: [{ type: 'NOT_FOUND', path: ['pullRequest0'] }],
      }),
    });

    const result = await createRepository().findRelatedOpenPrUrls([issueUrl]);

    expect(result.get(issueUrl)).toEqual([pullRequestUrl(2)]);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('recorded pull request is not found'),
    );
    expect(countBatchQueries(fetchSpy)).toBe(1);
    expect(countSingleQueries(fetchSpy)).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('falls back to one request when the batch has more than one page of review threads', async () => {
    const infoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    let singleRequestCount = 0;
    const fetchSpy = mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: () =>
        buildRecordedUrlsResponse([recordedComment(1)]),
      slimPullRequest: (number) => {
        singleRequestCount += 1;
        return buildSlimPullRequestResponse(number);
      },
      slimPullRequestBatch: () => ({
        data: {
          pullRequest0: {
            pullRequest: {
              ...buildSlimPullRequestNode(1),
              reviewThreads: {
                pageInfo: { endCursor: 'cursor-2', hasNextPage: true },
                nodes: [],
              },
            },
          },
        },
      }),
    });

    const result = await createRepository().findRelatedOpenPrUrls([issueUrl]);

    expect(result.get(issueUrl)).toEqual([pullRequestUrl(1)]);
    expect(singleRequestCount).toBe(1);
    expect(countBatchQueries(fetchSpy)).toBe(1);
    expect(countSingleQueries(fetchSpy)).toBe(1);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('omits a recorded pull request that is not found and keeps the other open URL', async () => {
    mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: () =>
        buildRecordedUrlsResponse([recordedComment(1), recordedComment(2)]),
      slimPullRequest: (number) =>
        number === 1
          ? { data: { repository: { pullRequest: null } } }
          : buildSlimPullRequestResponse(2),
    });
    const result = await createRepository().findRelatedOpenPrUrls([issueUrl]);
    expect(result.get(issueUrl)).toEqual([pullRequestUrl(2)]);
  });

  it('resolves three recorded open pull request URLs with one batch and no single query', async () => {
    const numbers = [1, 2, 3];
    const fetchSpy = mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: () =>
        buildRecordedUrlsResponse(numbers.map(recordedComment)),
      slimPullRequest: (number) => buildSlimPullRequestResponse(number),
      slimPullRequestBatch: buildBatchResponse,
    });
    const result = await createRepository().findRelatedOpenPrUrls([issueUrl]);
    expect(result.get(issueUrl)).toEqual(numbers.map(pullRequestUrl));
    expect(countBatchQueries(fetchSpy)).toBe(1);
    expect(countSingleQueries(fetchSpy)).toBe(0);
  });

  it('resolves one hundred recorded open pull request URLs with one batch and no single query', async () => {
    const numbers = Array.from({ length: 100 }, (_, index) => index + 1);
    const fetchSpy = mockFetchRoutes({
      relatedOpenPullRequestUrlsBatch: () =>
        buildRecordedUrlsResponse(numbers.map(recordedComment)),
      slimPullRequest: (number) => buildSlimPullRequestResponse(number),
      slimPullRequestBatch: buildBatchResponse,
    });
    const result = await createRepository().findRelatedOpenPrUrls([issueUrl]);
    expect(result.get(issueUrl)).toEqual(numbers.map(pullRequestUrl));
    expect(countBatchQueries(fetchSpy)).toBe(1);
    expect(countSingleQueries(fetchSpy)).toBe(0);
  });

  it('resolves mixed timeline and comment-recorded related pull requests with one batch and no single query', async () => {
    const numbers = [1, 2, 3];
    const fetchSpy = mockFetchRoutes({
      timeline: () =>
        buildIssueTimelineResponse(
          [buildTimelineNode(1)],
          [recordedComment(2), recordedComment(3)],
        ),
      slimPullRequest: (number) => buildSlimPullRequestResponse(number),
      slimPullRequestBatch: buildBatchResponse,
      checkRuns: () => ({ total_count: 0, check_runs: [] }),
    });
    const result = await createRepository().findRelatedOpenPRs(issueUrl);
    expect(result.map((pr) => pr.url)).toEqual(numbers.map(pullRequestUrl));
    expect(
      result.map((pr) => ({
        isConflicted: pr.isConflicted,
        mergeable: pr.mergeable,
        isPassedAllCiJob: pr.isPassedAllCiJob,
        isCiStateSuccess: pr.isCiStateSuccess,
        isBranchOutOfDate: pr.isBranchOutOfDate,
        missingRequiredCheckNames: pr.missingRequiredCheckNames,
      })),
    ).toEqual(
      numbers.map(() => ({
        isConflicted: false,
        mergeable: 'MERGEABLE',
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      })),
    );
    expect(countBatchQueries(fetchSpy)).toBe(1);
    expect(countSingleQueries(fetchSpy)).toBe(0);
  });

  it('resolves one hundred related pull requests with one batch and no single query', async () => {
    const numbers = Array.from({ length: 100 }, (_, index) => index + 1);
    const fetchSpy = mockFetchRoutes({
      timeline: () =>
        buildIssueTimelineResponse(
          numbers.map((number) => buildTimelineNode(number)),
        ),
      slimPullRequest: (number) => buildSlimPullRequestResponse(number),
      slimPullRequestBatch: buildBatchResponse,
      checkRuns: () => ({ total_count: 0, check_runs: [] }),
    });
    const result = await createRepository().findRelatedOpenPRs(issueUrl);
    expect(result.map((pr) => pr.url)).toEqual(numbers.map(pullRequestUrl));
    expect(countBatchQueries(fetchSpy)).toBe(1);
    expect(countSingleQueries(fetchSpy)).toBe(0);
  });
});
