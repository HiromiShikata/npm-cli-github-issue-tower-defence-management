import { mock } from 'jest-mock-extended';
import type { DateRepository } from '../../../domain/usecases/adapter-interfaces/DateRepository';
import type { ProjectRepository } from '../../../domain/usecases/adapter-interfaces/ProjectRepository';
import type { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import type { LocalStorageRepository } from '../LocalStorageRepository';
import { ApiV3CheerioRestIssueRepository } from './ApiV3CheerioRestIssueRepository';
import type { ApiV3IssueRepository } from './ApiV3IssueRepository';
import type { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import type { RestIssueRepository } from './RestIssueRepository';

describe('ApiV3CheerioRestIssueRepository CI status availability', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const ISSUE_URL =
    'https://github.com/HiromiShikata/test-repository/issues/100';
  const PR_URL = 'https://github.com/HiromiShikata/test-repository/pull/31';

  const buildTimelineResponse = (mergeable: string) => ({
    data: {
      repository: {
        issue: {
          timelineItems: {
            pageInfo: { endCursor: null, hasNextPage: false },
            nodes: [
              {
                __typename: 'CrossReferencedEvent',
                willCloseTarget: true,
                source: {
                  __typename: 'PullRequest',
                  url: PR_URL,
                  number: 31,
                  body: null,
                  state: 'OPEN',
                  createdAt: '2024-01-01T00:00:00Z',
                  isDraft: false,
                  mergeable,
                  headRefName: 'feature-branch',
                  baseRefName: 'main',
                  baseRef: { name: 'main' },
                },
              },
            ],
          },
        },
      },
    },
  });

  const passingCheckRuns = () => ({
    total_count: 1,
    check_runs: [{ id: 1, name: 'unit-test', conclusion: 'success' }],
  });

  const forbiddenCheckRuns = () =>
    new Response(
      JSON.stringify({ message: 'Resource not accessible by integration' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );

  const failedBranchRules = () =>
    new Response(JSON.stringify({ message: 'Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

  const warningMessages = (warnSpy: jest.SpyInstance): string[] =>
    warnSpy.mock.calls.map((call: unknown[]) => String(call[0]));

  const jsonResponse = (body: object): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const toResponse = (value: Response | object): Response =>
    value instanceof Response ? value : jsonResponse(value);

  type FetchRoutes = {
    timeline?: () => Response | object;
    mergeability?: () => Response | object;
    slimPullRequest?: (variables: {
      owner?: string;
      repo?: string;
      prNumber: number;
      reviewThreadsAfter: string | null;
    }) => Response | object;
    slimPullRequestBatch?: (
      variables: Record<string, unknown>,
    ) => Response | object;
    relatedOpenPullRequestUrlsBatch?: (
      variables: Record<string, unknown>,
    ) => Response | object;
    branchRules?: (url: string) => Response | object;
    branchDetail?: (url: string) => Response | object;
    checkRuns?: (url: string) => Response | object;
    checkSuites?: (url: string) => Response | object;
    combinedStatus?: (url: string) => Response | object;
  };

  const requestUrlOf = (input: RequestInfo | URL): string =>
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const requestBodyOf = (init?: RequestInit): string =>
    typeof init?.body === 'string' ? init.body : '';

  type GraphqlRequestBody = {
    query: string;
    variables: {
      owner?: string;
      repo?: string;
      prNumber: number;
      reviewThreadsAfter: string | null;
    };
    rawVariables: Record<string, unknown>;
  };

  const parseGraphqlRequestBody = (init?: RequestInit): GraphqlRequestBody => {
    const parsed: unknown = JSON.parse(requestBodyOf(init));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('query' in parsed) ||
      typeof parsed.query !== 'string'
    ) {
      throw new Error('Unexpected GraphQL request body in test');
    }
    const rawVariables: unknown =
      'variables' in parsed ? parsed.variables : null;
    const variables =
      typeof rawVariables === 'object' && rawVariables !== null
        ? rawVariables
        : {};
    const owner =
      'owner' in variables && typeof variables.owner === 'string'
        ? variables.owner
        : undefined;
    const repo =
      'repo' in variables && typeof variables.repo === 'string'
        ? variables.repo
        : undefined;
    const prNumber =
      'prNumber' in variables && typeof variables.prNumber === 'number'
        ? variables.prNumber
        : 0;
    const reviewThreadsAfter =
      'reviewThreadsAfter' in variables &&
      typeof variables.reviewThreadsAfter === 'string'
        ? variables.reviewThreadsAfter
        : null;
    return {
      query: parsed.query,
      variables: { owner, repo, prNumber, reviewThreadsAfter },
      rawVariables: Object.fromEntries(Object.entries(variables)),
    };
  };

  const mockFetchRoutes = (routes: FetchRoutes) =>
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = requestUrlOf(input);
          if (url === 'https://api.github.com/graphql') {
            const body = parseGraphqlRequestBody(init);
            if (
              body.query.includes('IssueRelatedOpenPullRequestUrlsBatch') &&
              routes.relatedOpenPullRequestUrlsBatch
            ) {
              return toResponse(
                routes.relatedOpenPullRequestUrlsBatch(body.rawVariables),
              );
            }
            if (body.query.includes('timelineItems') && routes.timeline) {
              return toResponse(routes.timeline());
            }
            if (
              body.query.includes('mergeStateStatus') &&
              routes.mergeability
            ) {
              return toResponse(routes.mergeability());
            }
            if (
              body.query.includes('PullRequestSlimStatusBatch') &&
              routes.slimPullRequestBatch
            ) {
              return toResponse(routes.slimPullRequestBatch(body.rawVariables));
            }
            if (body.query.includes('headRefOid') && routes.slimPullRequest) {
              return toResponse(routes.slimPullRequest(body.variables));
            }
            throw new Error(`Unexpected GraphQL query in test: ${body.query}`);
          }
          if (url.includes('/rules/branches/')) {
            return toResponse(
              routes.branchRules ? routes.branchRules(url) : [],
            );
          }
          if (/\/branches\/[^/?]+$/.test(url)) {
            return toResponse(
              routes.branchDetail ? routes.branchDetail(url) : {},
            );
          }
          if (url.includes('/check-suites') && !url.includes('/check-runs')) {
            return toResponse(
              routes.checkSuites
                ? routes.checkSuites(url)
                : { total_count: 0, check_suites: [] },
            );
          }
          if (url.includes('/check-runs')) {
            return toResponse(
              routes.checkRuns
                ? routes.checkRuns(url)
                : { total_count: 0, check_runs: [] },
            );
          }
          if (url.includes('/status?')) {
            return toResponse(
              routes.combinedStatus
                ? routes.combinedStatus(url)
                : { statuses: [] },
            );
          }
          throw new Error(`Unexpected fetch URL in test: ${url}`);
        },
      );
  const buildSlimPullRequestResponse = (
    overrides: {
      url?: string;
      state?: string;
      isDraft?: boolean;
      headRefName?: string;
      baseRefName?: string;
      mergeable?: string;
      headRefOid?: string;
      reviewThreads?: {
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
        nodes: Array<{ isResolved: boolean }>;
      };
    } = {},
  ) => ({
    data: {
      repository: {
        pullRequest: {
          url:
            overrides.url ??
            'https://github.com/HiromiShikata/test-repository/pull/31',
          state: overrides.state ?? 'OPEN',
          isDraft: overrides.isDraft ?? false,
          headRefName: overrides.headRefName ?? 'feature-branch',
          baseRefName: overrides.baseRefName ?? 'main',
          mergeable: overrides.mergeable ?? 'MERGEABLE',
          headRefOid: overrides.headRefOid ?? 'headsha123',
          reviewThreads: overrides.reviewThreads ?? {
            pageInfo: { endCursor: null, hasNextPage: false },
            nodes: [],
          },
        },
      },
    },
  });

  const createApiV3CheerioRestIssueRepository = () => {
    const apiV3IssueRepository = mock<ApiV3IssueRepository>();
    const restIssueRepository = mock<RestIssueRepository>();
    const graphqlProjectItemRepository = mock<GraphqlProjectItemRepository>();
    const localStorageCacheRepository = mock<LocalStorageCacheRepository>();
    localStorageCacheRepository.withLock.mockImplementation((_key, fn) => fn());
    const projectRepository = mock<ProjectRepository>();
    const dateRepository = mock<DateRepository>();
    const localStorageRepository = mock<LocalStorageRepository>();
    const sleep = jest.fn().mockResolvedValue(undefined);

    const repository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
      projectRepository,
      dateRepository,
      localStorageRepository,
      'dummy',
      sleep,
    );
    dateRepository.now.mockResolvedValue(new Date('2026-01-01T00:00:00.000Z'));
    restIssueRepository.getIssue.mockResolvedValue({
      labels: [],
      assignees: [],
      title: 'test-title',
      body: 'test-body',
      number: 38,
      state: 'OPEN',
      created_at: '2024-01-01T00:00:00Z',
    });
    return {
      repository,
      apiV3IssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
      localStorageRepository,
      projectRepository,
      dateRepository,
      sleep,
    };
  };
  it.each([
    {
      name: 'the check runs request for the PR head is forbidden',
      routes: { checkRuns: forbiddenCheckRuns },
      warningFragment:
        'Failed to fetch check runs for HiromiShikata/test-repository@headsha123: HTTP 403 permission denied',
    },
    {
      name: 'the required check names request fails',
      routes: { branchRules: failedBranchRules },
      warningFragment:
        'Failed to fetch branch rules for HiromiShikata/test-repository/main: HTTP 500',
    },
  ])(
    'keeps the related pull request with unknown CI status when $name and includeCiStatusUnavailable is true',
    async ({ routes, warningFragment }) => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetchRoutes({
        timeline: () => buildTimelineResponse('MERGEABLE'),
        slimPullRequest: () => buildSlimPullRequestResponse({ url: PR_URL }),
        ...routes,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(ISSUE_URL, {
        includeCiStatusUnavailable: true,
      });

      expect(result.map((pullRequest) => pullRequest.url)).toEqual([PR_URL]);
      expect(result[0]).toMatchObject({
        ciStatusAvailability: 'UNAVAILABLE',
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        missingRequiredCheckNames: [],
      });
      expect(
        warningMessages(warnSpy).some(
          (message) =>
            message.includes(PR_URL) && message.includes(warningFragment),
        ),
      ).toBe(true);
    },
  );

  it.each([
    { name: 'no options are given', options: undefined },
    {
      name: 'includeCiStatusUnavailable is true',
      options: { includeCiStatusUnavailable: true },
    },
  ])(
    'reports ciStatusAvailability AVAILABLE for a pull request whose CI status was fetched when $name',
    async ({ options }) => {
      mockFetchRoutes({
        timeline: () => buildTimelineResponse('MERGEABLE'),
        slimPullRequest: () => buildSlimPullRequestResponse({ url: PR_URL }),
        checkRuns: passingCheckRuns,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(ISSUE_URL, options);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        url: PR_URL,
        ciStatusAvailability: 'AVAILABLE',
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
      });
    },
  );

  it('does not return an UNAVAILABLE pull request from the TTL cache to a caller that passes no options', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const storedRecords = new Map<string, unknown>();
    const { repository, localStorageCacheRepository, dateRepository } =
      createApiV3CheerioRestIssueRepository();
    dateRepository.now.mockResolvedValue(new Date('2026-01-01T00:00:00.000Z'));
    localStorageCacheRepository.getSingle.mockImplementation(
      async (key: string) => storedRecords.get(key) ?? null,
    );
    localStorageCacheRepository.setSingle.mockImplementation(
      async (key: string, value: unknown) => {
        storedRecords.set(key, value);
      },
    );
    mockFetchRoutes({
      timeline: () => buildTimelineResponse('MERGEABLE'),
      slimPullRequest: () => buildSlimPullRequestResponse({ url: PR_URL }),
      checkRuns: forbiddenCheckRuns,
    });

    const firstResult = await repository.findRelatedOpenPRs(ISSUE_URL, {
      includeCiStatusUnavailable: true,
    });
    expect(firstResult.map((pullRequest) => pullRequest.url)).toEqual([PR_URL]);

    const secondResult = await repository.findRelatedOpenPRs(ISSUE_URL);
    expect(secondResult).toEqual([]);
  });
});
