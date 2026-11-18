const mockPost = jest.fn();

jest.mock('ky', () => {
  const actualKy: typeof import('ky') = jest.requireActual('ky');
  return {
    default: {
      post: mockPost,
      get: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      extend: jest.fn(),
      create: jest.fn(),
      stop: jest.fn(),
    },
    HTTPError: actualKy.HTTPError,
    __esModule: true,
  };
});

import {
  GraphqlProjectItemRepository,
  GraphqlRateLimitError,
} from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

type SentRequest = { query: string; variables: Record<string, unknown> };

const readSentRequests = (): SentRequest[] =>
  mockPost.mock.calls.map((call: unknown[]) => {
    const options: unknown = call[1];
    if (!isRecord(options)) {
      throw new Error('request options are missing');
    }
    const body: unknown = options.json;
    if (!isRecord(body)) {
      throw new Error('request body is missing');
    }
    const query: unknown = body.query;
    const variables: unknown = body.variables;
    if (typeof query !== 'string' || !isRecord(variables)) {
      throw new Error('request body lacks query or variables');
    }
    return { query, variables };
  });

type Settled<T> =
  { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

const settleWithTimers = async <T>(
  promise: Promise<T>,
): Promise<Settled<T>> => {
  const settled = promise.then(
    (value): Settled<T> => ({ status: 'fulfilled', value }),
    (reason: unknown): Settled<T> => ({ status: 'rejected', reason }),
  );
  await jest.runAllTimersAsync();
  return settled;
};

const fulfilledValue = <T>(outcome: Settled<T>): T | undefined =>
  outcome.status === 'fulfilled' ? outcome.value : undefined;

const rejectionMessage = <T>(outcome: Settled<T>): string => {
  if (outcome.status !== 'rejected') {
    return '';
  }
  return outcome.reason instanceof Error ? outcome.reason.message : '';
};

const REPOSITORY_NAME_WITH_OWNER = 'client-org/client-app';
const PROJECT_ID = 'PVT_test_project';
const PROJECT_QUERY = 'repo:client-org/client-app';
const ISSUE_URL = 'https://github.com/client-org/client-app/issues/7';
const PULL_REQUEST_URL = 'https://github.com/client-org/client-app/pull/8';

const statusValue = (name: string) => ({
  __typename: 'ProjectV2ItemFieldSingleSelectValue',
  name,
  field: { name: 'Status' },
});

const issueSideItem = (input: {
  id: string;
  projectId: string;
  isArchived?: boolean;
  status?: string;
}) => ({
  id: input.id,
  project: { id: input.projectId },
  isArchived: input.isArchived ?? false,
  fieldValues: { nodes: [statusValue(input.status ?? 'Preparation')] },
});

const issueSideContent = (
  url: string,
  number: number,
  projectItems: unknown[],
) => ({
  number,
  title: `Title ${number}`,
  state: 'OPEN',
  url,
  body: 'body text',
  createdAt: '2024-01-01T00:00:00Z',
  author: { login: 'octocat' },
  labels: { nodes: [] },
  assignees: { nodes: [] },
  repository: { nameWithOwner: REPOSITORY_NAME_WITH_OWNER, isArchived: false },
  projectItems: { nodes: projectItems },
});

const issueSideIssueResponse = (projectItems: unknown[]) =>
  mockJsonResponse({
    data: {
      repository: {
        issue: issueSideContent(ISSUE_URL, 7, projectItems),
        pullRequest: null,
      },
    },
  });

const issueSidePullRequestResponse = (projectItems: unknown[]) =>
  mockJsonResponse({
    data: {
      repository: {
        issue: null,
        pullRequest: issueSideContent(PULL_REQUEST_URL, 8, projectItems),
      },
    },
  });

const issueOrPullRequestProjectItemsResponse = (nodes: unknown[]) =>
  mockJsonResponse({
    data: { repository: { issueOrPullRequest: { projectItems: { nodes } } } },
  });

const projectSideContent = (
  url: string,
  number: number,
  typename: 'Issue' | 'PullRequest' = 'Issue',
) => ({
  __typename: typename,
  number,
  title: `Title ${number}`,
  url,
  repository: { nameWithOwner: REPOSITORY_NAME_WITH_OWNER },
});

const projectSideItem = (input: {
  id: string;
  content: unknown;
  isArchived?: boolean;
  status?: string;
}) => ({
  id: input.id,
  isArchived: input.isArchived ?? false,
  fieldValues: { nodes: [statusValue(input.status ?? 'In Progress')] },
  content: input.content,
});

const projectSidePage = (
  hasNextPage: boolean,
  endCursor: string,
  totalCount: number,
  nodes: unknown[],
) =>
  mockJsonResponse({
    data: {
      node: {
        items: {
          totalCount,
          pageInfo: { hasNextPage, endCursor },
          nodes,
        },
      },
    },
  });

const projectSideEmptyPage = () =>
  projectSidePage(false, 'cursor-empty', 0, []);

const projectSideRateLimitResponse = () =>
  mockJsonResponse({
    errors: [{ type: 'RATE_LIMIT', message: 'quota exhausted' }],
  });

const projectSideErrorsWithoutDataResponse = () =>
  mockJsonResponse({
    errors: [{ message: 'boom' }],
  });

const duplicateContentResponse = () =>
  mockJsonResponse({
    errors: [{ message: 'Content already exists in this project' }],
  });

const contentIdResponse = (contentId: string) =>
  mockJsonResponse({
    data: { repository: { issueOrPullRequest: { id: contentId } } },
  });

const deleteItemResponse = () =>
  mockJsonResponse({
    data: { deleteProjectV2Item: { clientMutationId: 'mutation-id' } },
  });

const exactIssueContent = () => projectSideContent(ISSUE_URL, 7);

const nonMatchingIssueContent = (number: number) =>
  projectSideContent(
    `https://github.com/client-org/client-app/issues/${number}`,
    number,
  );

const newRepository = () =>
  new GraphqlProjectItemRepository(new LocalStorageRepository(), 'dummy-token');

describe('GraphqlProjectItemRepository project-side fallback', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockPost.mockReset();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('same-owner lookups that the issue side already resolves (pinning)', () => {
    it('returns the issue-side project item with its customFields and archive flag in a single request when the issue lists the project', async () => {
      const cases = [
        { name: 'active item', isArchived: false, expectedArchived: false },
        { name: 'archived item', isArchived: true, expectedArchived: true },
      ];

      for (const testCase of cases) {
        mockPost.mockReset();
        mockPost.mockReturnValueOnce(
          issueSideIssueResponse([
            issueSideItem({
              id: 'item-a1',
              projectId: PROJECT_ID,
              isArchived: testCase.isArchived,
              status: 'Preparation',
            }),
          ]),
        );

        const result = await newRepository().fetchProjectItemByUrl(
          ISSUE_URL,
          PROJECT_ID,
        );

        expect({
          name: testCase.name,
          id: result?.id,
          customFields: result?.customFields,
          isArchivedFromProject: result?.isArchivedFromProject,
          requestCount: mockPost.mock.calls.length,
        }).toEqual({
          name: testCase.name,
          id: 'item-a1',
          customFields: [{ name: 'Status', value: 'Preparation' }],
          isArchivedFromProject: testCase.expectedArchived,
          requestCount: 1,
        });
      }
    });

    it('returns the issue-side item id in a single request for fetchItemId when the issue lists the project', async () => {
      mockPost.mockReturnValueOnce(
        issueOrPullRequestProjectItemsResponse([
          { id: 'item-a2', project: { id: PROJECT_ID } },
        ]),
      );

      const result = await newRepository().fetchItemId(
        PROJECT_ID,
        'client-org',
        'client-app',
        7,
      );

      expect(result).toBe('item-a2');
      expect(readSentRequests()).toHaveLength(1);
    });

    it('sends the removal mutation with the issue-side item id when the issue lists the project', async () => {
      mockPost
        .mockReturnValueOnce(
          issueOrPullRequestProjectItemsResponse([
            { id: 'item-a3', project: { id: PROJECT_ID } },
          ]),
        )
        .mockReturnValueOnce(deleteItemResponse());

      const outcome = await settleWithTimers(
        newRepository().removeItemFromProjectByIssueUrl(ISSUE_URL, PROJECT_ID),
      );

      expect(outcome.status).toBe('fulfilled');
      const requests = readSentRequests();
      expect(requests).toHaveLength(2);
      expect(requests[1].query).toContain('deleteProjectV2Item');
      expect(JSON.stringify(requests[1].variables)).toContain('item-a3');
    });

    it('returns the existing item id from the issue side when addIssueToProject hits the duplicate error', async () => {
      mockPost
        .mockReturnValueOnce(contentIdResponse('content-node-a4'))
        .mockReturnValueOnce(duplicateContentResponse())
        .mockReturnValueOnce(
          issueOrPullRequestProjectItemsResponse([
            { id: 'existing-item-a4', project: { id: PROJECT_ID } },
          ]),
        );

      const result = await settleWithTimers(
        newRepository().addIssueToProject(PROJECT_ID, ISSUE_URL),
      );

      expect(result).toEqual({
        status: 'fulfilled',
        value: 'existing-item-a4',
      });
      expect(readSentRequests()).toHaveLength(3);
    });
  });

  describe('fetchProjectItemByUrl with a projectId when the issue side has no item', () => {
    it('returns the project-side item with customFields built from its fieldValues when the first project-side page matches the issue URL', async () => {
      mockPost
        .mockReturnValueOnce(issueSideIssueResponse([]))
        .mockReturnValueOnce(
          projectSidePage(false, 'cursor-b1', 1, [
            projectSideItem({
              id: 'project-side-item-b1',
              content: exactIssueContent(),
              status: 'In Progress',
            }),
          ]),
        );
      const warnCallsBefore = warnSpy.mock.calls.length;

      const outcome = await settleWithTimers(
        newRepository().fetchProjectItemByUrl(ISSUE_URL, PROJECT_ID),
      );

      expect(outcome.status).toBe('fulfilled');
      expect(fulfilledValue(outcome)).toMatchObject({
        id: 'project-side-item-b1',
        url: ISSUE_URL,
        customFields: [{ name: 'Status', value: 'In Progress' }],
      });
      const requests = readSentRequests();
      expect(requests).toHaveLength(2);
      expect(requests[1].query).toContain('items(');
      expect(requests[1].variables).toMatchObject({
        projectId: PROJECT_ID,
        query: PROJECT_QUERY,
      });
      expect(
        warnSpy.mock.calls
          .slice(warnCallsBefore)
          .some((args: unknown[]) =>
            String(args[0]).includes('No project item found'),
          ),
      ).toBe(false);
    });

    it('follows endCursor to the second project-side page and returns the match found there', async () => {
      mockPost
        .mockReturnValueOnce(issueSideIssueResponse([]))
        .mockReturnValueOnce(
          projectSidePage(true, 'cursor-1', 2, [
            projectSideItem({
              id: 'project-side-item-b2-other',
              content: nonMatchingIssueContent(8),
            }),
          ]),
        )
        .mockReturnValueOnce(
          projectSidePage(false, 'cursor-2', 2, [
            projectSideItem({
              id: 'project-side-item-b2',
              content: exactIssueContent(),
            }),
          ]),
        );

      const outcome = await settleWithTimers(
        newRepository().fetchProjectItemByUrl(ISSUE_URL, PROJECT_ID),
      );

      expect(outcome.status).toBe('fulfilled');
      expect(fulfilledValue(outcome)).toMatchObject({
        id: 'project-side-item-b2',
        url: ISSUE_URL,
      });
      const requests = readSentRequests();
      expect(requests).toHaveLength(3);
      expect(requests[2].variables).toMatchObject({
        projectId: PROJECT_ID,
        query: PROJECT_QUERY,
        after: 'cursor-1',
      });
    });

    it('returns null and warns with the exact message when no project-side page matches the issue URL across all pages', async () => {
      mockPost
        .mockReturnValueOnce(issueSideIssueResponse([]))
        .mockReturnValueOnce(
          projectSidePage(true, 'cursor-1', 2, [
            projectSideItem({
              id: 'project-side-item-b3-8',
              content: nonMatchingIssueContent(8),
            }),
          ]),
        )
        .mockReturnValueOnce(
          projectSidePage(false, 'cursor-2', 2, [
            projectSideItem({
              id: 'project-side-item-b3-9',
              content: nonMatchingIssueContent(9),
            }),
          ]),
        );

      const outcome = await settleWithTimers(
        newRepository().fetchProjectItemByUrl(ISSUE_URL, PROJECT_ID),
      );

      expect(outcome).toEqual({ status: 'fulfilled', value: null });
      expect(readSentRequests()).toHaveLength(3);
      expect(warnSpy).toHaveBeenCalledWith(
        'No project item found for issue https://github.com/client-org/client-app/issues/7 on project PVT_test_project',
      );
    });

    it('returns the project-side item when the pull request URL matches on the project side', async () => {
      mockPost
        .mockReturnValueOnce(issueSidePullRequestResponse([]))
        .mockReturnValueOnce(
          projectSidePage(false, 'cursor-b4', 1, [
            projectSideItem({
              id: 'project-side-item-b4',
              content: projectSideContent(PULL_REQUEST_URL, 8, 'PullRequest'),
            }),
          ]),
        );

      const outcome = await settleWithTimers(
        newRepository().fetchProjectItemByUrl(PULL_REQUEST_URL, PROJECT_ID),
      );

      expect(outcome.status).toBe('fulfilled');
      expect(fulfilledValue(outcome)).toMatchObject({
        id: 'project-side-item-b4',
        url: PULL_REQUEST_URL,
      });
      expect(readSentRequests()).toHaveLength(2);
    });

    it('matches project-side content only by exact issue URL and reports archive state for each case', async () => {
      type ExpectedRow = {
        status: 'fulfilled' | 'rejected';
        id: string | null;
        isArchivedFromProject: boolean | null;
      };
      const cases: Array<{
        name: string;
        content: unknown;
        isArchived: boolean;
        expected: ExpectedRow;
      }> = [
        {
          name: 'exact issue URL',
          content: exactIssueContent(),
          isArchived: false,
          expected: {
            status: 'fulfilled',
            id: 'project-side-item-b5',
            isArchivedFromProject: false,
          },
        },
        {
          name: 'same repository different issue number',
          content: nonMatchingIssueContent(70),
          isArchived: false,
          expected: {
            status: 'fulfilled',
            id: null,
            isArchivedFromProject: null,
          },
        },
        {
          name: 'same number in a different repository of the same owner',
          content: projectSideContent(
            'https://github.com/client-org/other-app/issues/7',
            7,
          ),
          isArchived: false,
          expected: {
            status: 'fulfilled',
            id: null,
            isArchivedFromProject: null,
          },
        },
        {
          name: 'DraftIssue content without url',
          content: { __typename: 'DraftIssue', title: 'Draft item' },
          isArchived: false,
          expected: {
            status: 'fulfilled',
            id: null,
            isArchivedFromProject: null,
          },
        },
        {
          name: 'archived item with exact issue URL',
          content: exactIssueContent(),
          isArchived: true,
          expected: {
            status: 'fulfilled',
            id: 'project-side-item-b5',
            isArchivedFromProject: true,
          },
        },
      ];

      for (const testCase of cases) {
        mockPost.mockReset();
        mockPost
          .mockReturnValueOnce(issueSideIssueResponse([]))
          .mockReturnValueOnce(
            projectSidePage(false, 'cursor-b5', 1, [
              projectSideItem({
                id: 'project-side-item-b5',
                content: testCase.content,
                isArchived: testCase.isArchived,
              }),
            ]),
          );

        const outcome = await settleWithTimers(
          newRepository().fetchProjectItemByUrl(ISSUE_URL, PROJECT_ID),
        );

        const row: ExpectedRow =
          outcome.status === 'fulfilled'
            ? {
                status: 'fulfilled',
                id: outcome.value?.id ?? null,
                isArchivedFromProject:
                  outcome.value?.isArchivedFromProject ?? null,
              }
            : { status: 'rejected', id: null, isArchivedFromProject: null };

        expect({ name: testCase.name, ...row }).toEqual({
          name: testCase.name,
          ...testCase.expected,
        });
        expect(readSentRequests()).toHaveLength(2);
      }
    });

    it('rejects with the no-data error when the project-side response has errors and no data', async () => {
      mockPost
        .mockReturnValueOnce(issueSideIssueResponse([]))
        .mockReturnValue(projectSideErrorsWithoutDataResponse());

      const outcome = await settleWithTimers(
        newRepository().fetchProjectItemByUrl(ISSUE_URL, PROJECT_ID),
      );

      expect(outcome.status).toBe('rejected');
      expect(rejectionMessage(outcome)).toContain(
        'GitHub GraphQL API returned no data',
      );
    });
  });

  describe('fetchItemId when the issue side has no item', () => {
    it('resolves the project-side item id from the first page when it matches and returns undefined when nothing matches', async () => {
      const cases: Array<{
        name: string;
        items: unknown[];
        expected: string | undefined;
      }> = [
        {
          name: 'matching item on the first project-side page',
          items: [
            projectSideItem({
              id: 'project-side-item-b7',
              content: exactIssueContent(),
            }),
          ],
          expected: 'project-side-item-b7',
        },
        {
          name: 'no matching item on the project side',
          items: [
            projectSideItem({
              id: 'project-side-item-b7-other',
              content: nonMatchingIssueContent(8),
            }),
          ],
          expected: undefined,
        },
      ];

      for (const testCase of cases) {
        mockPost.mockReset();
        mockPost
          .mockReturnValueOnce(issueOrPullRequestProjectItemsResponse([]))
          .mockReturnValueOnce(
            projectSidePage(
              false,
              'cursor-b7',
              testCase.items.length,
              testCase.items,
            ),
          );

        const outcome = await settleWithTimers(
          newRepository().fetchItemId(
            PROJECT_ID,
            'client-org',
            'client-app',
            7,
          ),
        );

        expect({ name: testCase.name, outcome }).toEqual({
          name: testCase.name,
          outcome: { status: 'fulfilled', value: testCase.expected },
        });
        expect(readSentRequests()).toHaveLength(2);
      }
    });

    it('propagates GraphqlRateLimitError from the project-side fallback in fetchItemId', async () => {
      mockPost
        .mockReturnValueOnce(issueOrPullRequestProjectItemsResponse([]))
        .mockReturnValue(projectSideRateLimitResponse());

      const outcome = await settleWithTimers(
        newRepository().fetchItemId(PROJECT_ID, 'client-org', 'client-app', 7),
      );

      expect(outcome.status).toBe('rejected');
      expect(
        outcome.status === 'rejected' &&
          outcome.reason instanceof GraphqlRateLimitError,
      ).toBe(true);
    });

    it('returns undefined and logs the error when the project side returns errors without data', async () => {
      mockPost
        .mockReturnValueOnce(issueOrPullRequestProjectItemsResponse([]))
        .mockReturnValue(projectSideErrorsWithoutDataResponse());

      const outcome = await settleWithTimers(
        newRepository().fetchItemId(PROJECT_ID, 'client-org', 'client-app', 7),
      );

      expect(outcome).toEqual({ status: 'fulfilled', value: undefined });
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('removeItemFromProjectByIssueUrl when the issue side has no item', () => {
    it('sends the removal mutation with the project-side item id when the project side matches', async () => {
      mockPost
        .mockReturnValueOnce(issueOrPullRequestProjectItemsResponse([]))
        .mockReturnValueOnce(
          projectSidePage(false, 'cursor-b9', 1, [
            projectSideItem({
              id: 'project-side-item-b9',
              content: exactIssueContent(),
            }),
          ]),
        )
        .mockReturnValueOnce(deleteItemResponse());

      const outcome = await settleWithTimers(
        newRepository().removeItemFromProjectByIssueUrl(ISSUE_URL, PROJECT_ID),
      );

      expect(outcome).toEqual({ status: 'fulfilled', value: undefined });
      const requests = readSentRequests();
      expect(requests).toHaveLength(3);
      expect(requests[2].query).toContain('deleteProjectV2Item');
      expect(JSON.stringify(requests[2].variables)).toContain(
        'project-side-item-b9',
      );
    });

    it('rejects with Issue not found in project when neither side has the item', async () => {
      mockPost
        .mockReturnValueOnce(issueOrPullRequestProjectItemsResponse([]))
        .mockReturnValue(projectSideEmptyPage());

      const outcome = await settleWithTimers(
        newRepository().removeItemFromProjectByIssueUrl(ISSUE_URL, PROJECT_ID),
      );

      expect(outcome.status).toBe('rejected');
      expect(rejectionMessage(outcome)).toContain('Issue not found in project');
    });
  });

  describe('addIssueToProject duplicate branch when the issue side has no item', () => {
    it('returns the project-side item id when the add mutation reports a duplicate and the project side matches', async () => {
      mockPost
        .mockReturnValueOnce(contentIdResponse('content-node-b10'))
        .mockReturnValueOnce(duplicateContentResponse())
        .mockReturnValueOnce(issueOrPullRequestProjectItemsResponse([]))
        .mockReturnValueOnce(
          projectSidePage(false, 'cursor-b10', 1, [
            projectSideItem({
              id: 'project-side-item-b10',
              content: exactIssueContent(),
            }),
          ]),
        );

      const outcome = await settleWithTimers(
        newRepository().addIssueToProject(PROJECT_ID, ISSUE_URL),
      );

      expect(outcome).toEqual({
        status: 'fulfilled',
        value: 'project-side-item-b10',
      });
      expect(readSentRequests()).toHaveLength(4);
    });

    it('rejects with could not retrieve existing item id when neither side has the item', async () => {
      mockPost
        .mockReturnValueOnce(contentIdResponse('content-node-b10-missing'))
        .mockReturnValueOnce(duplicateContentResponse())
        .mockReturnValueOnce(issueOrPullRequestProjectItemsResponse([]))
        .mockReturnValue(projectSideEmptyPage());

      const outcome = await settleWithTimers(
        newRepository().addIssueToProject(PROJECT_ID, ISSUE_URL),
      );

      expect(outcome.status).toBe('rejected');
      expect(rejectionMessage(outcome)).toContain(
        'could not retrieve existing item id',
      );
    });
  });

  describe('same-owner cost guard', () => {
    it('makes no project-side request when the issue side already lists the project for fetchProjectItemByUrl and fetchItemId', async () => {
      const cases: Array<{
        name: string;
        makeResponse: () => ReturnType<typeof issueSideIssueResponse>;
        run: (
          repository: GraphqlProjectItemRepository,
        ) => Promise<string | undefined>;
        expectedId: string;
      }> = [
        {
          name: 'fetchProjectItemByUrl',
          makeResponse: () =>
            issueSideIssueResponse([
              issueSideItem({ id: 'item-b11-url', projectId: PROJECT_ID }),
            ]),
          run: async (repository) =>
            (await repository.fetchProjectItemByUrl(ISSUE_URL, PROJECT_ID))?.id,
          expectedId: 'item-b11-url',
        },
        {
          name: 'fetchItemId',
          makeResponse: () =>
            issueOrPullRequestProjectItemsResponse([
              { id: 'item-b11-id', project: { id: PROJECT_ID } },
            ]),
          run: (repository) =>
            repository.fetchItemId(PROJECT_ID, 'client-org', 'client-app', 7),
          expectedId: 'item-b11-id',
        },
      ];

      for (const testCase of cases) {
        mockPost.mockReset();
        mockPost.mockReturnValueOnce(testCase.makeResponse());

        const id = await testCase.run(newRepository());

        const requests = readSentRequests();
        expect({
          name: testCase.name,
          id,
          requestCount: requests.length,
        }).toEqual({
          name: testCase.name,
          id: testCase.expectedId,
          requestCount: 1,
        });
        for (const request of requests) {
          expect(request.query).toContain('projectItems');
          expect(request.query).not.toContain('items(');
        }
      }
    });
  });
});
