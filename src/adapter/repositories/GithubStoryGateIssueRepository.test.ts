import {
  GithubIssueReference,
  StoryGateGithubRequestError,
} from '../../domain/usecases/adapter-interfaces/StoryGateIssueRepository';
import {
  CLOSING_PULL_REQUESTS_QUERY,
  GithubStoryGateIssueRepository,
  ISSUE_PROJECT_ITEMS_QUERY,
  PROJECT_ITEM_SINGLE_SELECT_UPDATE_MUTATION,
} from './GithubStoryGateIssueRepository';

const ISSUE: GithubIssueReference = {
  owner: 'owner',
  repo: 'repo',
  number: 3,
  url: 'https://github.com/owner/repo/issues/3',
};
const ISSUE_API_URL = 'https://api.github.com/repos/owner/repo/issues/3';
const GRAPHQL_URL = 'https://api.github.com/graphql';

const jsonResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const noWait = jest.fn(async (_milliseconds: number): Promise<void> => {});

const repositoryCreate = (): GithubStoryGateIssueRepository =>
  new GithubStoryGateIssueRepository('test-token', noWait);

const requestOf = (
  fetchSpy: jest.SpiedFunction<typeof fetch>,
  callIndex: number,
): { url: string; method: string | undefined; body: unknown } => {
  const [input, init] = fetchSpy.mock.calls[callIndex];
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const rawBody = init?.body;
  const body: unknown =
    typeof rawBody === 'string' ? JSON.parse(rawBody) : undefined;
  return { url, method: init?.method, body };
};

const authorizationOf = (
  fetchSpy: jest.SpiedFunction<typeof fetch>,
  callIndex: number,
): string | null => {
  const [, init] = fetchSpy.mock.calls[callIndex];
  return new Headers(init?.headers).get('authorization');
};

const selectField = (id: string, options: string[]) => ({
  id,
  options: options.map((name, index) => ({
    id: `${id}_${index}`,
    name,
    color: index === 0 ? 'GRAY' : 'GREEN',
  })),
});

describe('GithubStoryGateIssueRepository', () => {
  beforeEach(() => {
    noWait.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findIssue', () => {
    it.each([
      {
        name: 'an open issue with labels',
        response: {
          state: 'open',
          body: 'Issue body',
          labels: [{ name: 'story' }, { name: 'bug' }],
        },
        expected: {
          url: ISSUE.url,
          state: 'OPEN',
          body: 'Issue body',
          labels: ['story', 'bug'],
        },
      },
      {
        name: 'a closed issue without a body',
        response: { state: 'closed', body: null, labels: [] },
        expected: { url: ISSUE.url, state: 'CLOSED', body: '', labels: [] },
      },
    ])('maps $name', async ({ response, expected }) => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse(response));

      const issue = await repositoryCreate().findIssue(ISSUE);

      expect(issue).toEqual(expected);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(requestOf(fetchSpy, 0)).toEqual({
        url: ISSUE_API_URL,
        method: 'GET',
        body: undefined,
      });
      expect(authorizationOf(fetchSpy, 0)).toBe('Bearer test-token');
    });

    it('returns null for HTTP 404', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404));

      await expect(repositoryCreate().findIssue(ISSUE)).resolves.toBeNull();
    });

    it('rejects with the failing request for HTTP 500', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ message: 'Server Error' }, 500));

      const promise = repositoryCreate().findIssue(ISSUE);

      await expect(promise).rejects.toThrow(StoryGateGithubRequestError);
      await expect(promise).rejects.toThrow(ISSUE_API_URL);
      await expect(promise).rejects.toThrow('500');
    });

    it('retries HTTP 429 after the injected wait', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          jsonResponse({ message: 'rate limited' }, 429, {
            'retry-after': '7',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ state: 'open', body: 'After retry', labels: [] }),
        );

      const issue = await repositoryCreate().findIssue(ISSUE);

      expect(issue).toEqual({
        url: ISSUE.url,
        state: 'OPEN',
        body: 'After retry',
        labels: [],
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(noWait).toHaveBeenCalledTimes(1);
      expect(noWait).toHaveBeenCalledWith(7000);
    });

    it('rejects when HTTP 429 persists', async () => {
      jest.spyOn(global, 'fetch').mockImplementation(async () =>
        jsonResponse({ message: 'rate limited' }, 429, {
          'retry-after': '1',
        }),
      );

      await expect(repositoryCreate().findIssue(ISSUE)).rejects.toThrow(
        StoryGateGithubRequestError,
      );
      expect(noWait).toHaveBeenCalled();
    });

    it('rejects when fetch throws', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('network down'));

      await expect(repositoryCreate().findIssue(ISSUE)).rejects.toThrow(
        StoryGateGithubRequestError,
      );
    });
  });

  describe('listIssueComments', () => {
    it('reads every page and maps each comment', async () => {
      const firstPage = Array.from({ length: 100 }, (_, index) => ({
        html_url: `${ISSUE.url}#issuecomment-${index + 1}`,
        created_at: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
        body: `comment ${index + 1}`,
      }));
      const secondPage = [
        {
          html_url: `${ISSUE.url}#issuecomment-101`,
          created_at: '2026-09-02T00:00:00Z',
          body: 'comment 101',
        },
      ];
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse(firstPage))
        .mockResolvedValueOnce(jsonResponse(secondPage));

      const comments = await repositoryCreate().listIssueComments(ISSUE);

      expect(comments).toHaveLength(101);
      expect(comments[0]).toEqual({
        url: `${ISSUE.url}#issuecomment-1`,
        createdAt: firstPage[0].created_at,
        body: 'comment 1',
      });
      expect(comments[100]).toEqual({
        url: `${ISSUE.url}#issuecomment-101`,
        createdAt: '2026-09-02T00:00:00Z',
        body: 'comment 101',
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [firstRequest, secondRequest] = [0, 1].map((index) =>
        requestOf(fetchSpy, index),
      );
      expect(firstRequest.method).toBe('GET');
      expect(new URL(firstRequest.url).pathname).toBe(
        '/repos/owner/repo/issues/3/comments',
      );
      expect(new URL(firstRequest.url).searchParams.get('page')).toBe('1');
      expect(new URL(secondRequest.url).searchParams.get('page')).toBe('2');
    });

    it('rejects for HTTP 500', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ message: 'Server Error' }, 500));

      await expect(repositoryCreate().listIssueComments(ISSUE)).rejects.toThrow(
        StoryGateGithubRequestError,
      );
    });
  });

  describe('findIssueProjectItems', () => {
    const storyField = selectField('FIELD_story', ['retired', 'feature A']);
    const agentField = selectField('FIELD_agent', ['developer-agent']);
    const statusField = selectField('FIELD_status', ['Awaiting Workspace']);

    it.each([
      {
        name: 'a field named Story',
        upperStoryField: storyField,
        lowerStoryField: null,
        upperStory: { name: 'feature A' },
        lowerStory: null,
      },
      {
        name: 'a field named story',
        upperStoryField: null,
        lowerStoryField: storyField,
        upperStory: null,
        lowerStory: { name: 'feature A' },
      },
    ])(
      'maps the Story of $name',
      async ({ upperStoryField, lowerStoryField, upperStory, lowerStory }) => {
        const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
          jsonResponse({
            data: {
              repository: {
                issueOrPullRequest: {
                  state: 'OPEN',
                  projectItems: {
                    nodes: [
                      {
                        id: 'ITEM_1',
                        project: {
                          id: 'PVT_board',
                          upperStoryField,
                          lowerStoryField,
                          agentField,
                          statusField,
                        },
                        upperStory,
                        lowerStory,
                        agent: { name: 'developer-agent' },
                        status: { name: 'Awaiting Workspace' },
                      },
                    ],
                  },
                },
              },
            },
          }),
        );

        const snapshot = await repositoryCreate().findIssueProjectItems(ISSUE);

        expect(snapshot).toEqual({
          state: 'OPEN',
          items: [
            {
              projectId: 'PVT_board',
              itemId: 'ITEM_1',
              storyField: {
                fieldId: 'FIELD_story',
                options: [
                  { id: 'FIELD_story_0', name: 'retired', color: 'GRAY' },
                  { id: 'FIELD_story_1', name: 'feature A', color: 'GREEN' },
                ],
              },
              storyName: 'feature A',
              agentField: {
                fieldId: 'FIELD_agent',
                options: [
                  {
                    id: 'FIELD_agent_0',
                    name: 'developer-agent',
                    color: 'GRAY',
                  },
                ],
              },
              agentName: 'developer-agent',
              statusField: {
                fieldId: 'FIELD_status',
                options: [
                  {
                    id: 'FIELD_status_0',
                    name: 'Awaiting Workspace',
                    color: 'GRAY',
                  },
                ],
              },
              statusName: 'Awaiting Workspace',
            },
          ],
        });
        expect(requestOf(fetchSpy, 0)).toEqual({
          url: GRAPHQL_URL,
          method: 'POST',
          body: {
            query: ISSUE_PROJECT_ITEMS_QUERY,
            variables: { owner: 'owner', repo: 'repo', number: 3 },
          },
        });
        expect(authorizationOf(fetchSpy, 0)).toBe('Bearer test-token');
      },
    );

    it('maps a closed issue without Story, Agent or Status values', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        jsonResponse({
          data: {
            repository: {
              issueOrPullRequest: {
                state: 'CLOSED',
                projectItems: {
                  nodes: [
                    {
                      id: 'ITEM_1',
                      project: {
                        id: 'PVT_board',
                        upperStoryField: null,
                        lowerStoryField: null,
                        agentField: null,
                        statusField: null,
                      },
                      upperStory: null,
                      lowerStory: null,
                      agent: null,
                      status: null,
                    },
                  ],
                },
              },
            },
          },
        }),
      );

      const snapshot = await repositoryCreate().findIssueProjectItems(ISSUE);

      expect(snapshot).toEqual({
        state: 'CLOSED',
        items: [
          {
            projectId: 'PVT_board',
            itemId: 'ITEM_1',
            storyField: null,
            storyName: null,
            agentField: null,
            agentName: null,
            statusField: null,
            statusName: null,
          },
        ],
      });
    });

    it('returns null when the issue is not found', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        jsonResponse({
          data: { repository: null },
          errors: [
            {
              type: 'NOT_FOUND',
              message: 'Could not resolve to a Repository',
            },
          ],
        }),
      );

      await expect(
        repositoryCreate().findIssueProjectItems(ISSUE),
      ).resolves.toBeNull();
    });

    it('rejects when GraphQL returns errors', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        jsonResponse({
          data: null,
          errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible' }],
        }),
      );

      const promise = repositoryCreate().findIssueProjectItems(ISSUE);

      await expect(promise).rejects.toThrow(StoryGateGithubRequestError);
      await expect(promise).rejects.toThrow('Resource not accessible');
    });

    it('rejects with the GraphQL URL for HTTP 500', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ message: 'Server Error' }, 500));

      await expect(
        repositoryCreate().findIssueProjectItems(ISSUE),
      ).rejects.toThrow(GRAPHQL_URL);
    });

    it('retries HTTP 429 after the injected wait', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          jsonResponse({ message: 'rate limited' }, 429, {
            'retry-after': '3',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            data: {
              repository: {
                issueOrPullRequest: {
                  state: 'OPEN',
                  projectItems: { nodes: [] },
                },
              },
            },
          }),
        );

      const snapshot = await repositoryCreate().findIssueProjectItems(ISSUE);

      expect(snapshot).toEqual({ state: 'OPEN', items: [] });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(noWait).toHaveBeenCalledWith(3000);
    });
  });

  describe('listClosingPullRequests', () => {
    it('maps pull requests that close the issue once each', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        jsonResponse({
          data: {
            repository: {
              issueOrPullRequest: {
                timelineItems: {
                  nodes: [
                    {
                      willCloseTarget: true,
                      source: {
                        url: 'https://github.com/owner/repo/pull/9',
                        state: 'OPEN',
                      },
                    },
                    {
                      willCloseTarget: true,
                      source: {
                        url: 'https://github.com/owner/repo/pull/10',
                        state: 'MERGED',
                      },
                    },
                    {
                      willCloseTarget: false,
                      source: {
                        url: 'https://github.com/owner/repo/pull/11',
                        state: 'OPEN',
                      },
                    },
                    {
                      willCloseTarget: true,
                      source: {
                        url: 'https://github.com/owner/repo/pull/9',
                        state: 'OPEN',
                      },
                    },
                    { willCloseTarget: true, source: {} },
                  ],
                },
              },
            },
          },
        }),
      );

      const pullRequests =
        await repositoryCreate().listClosingPullRequests(ISSUE);

      expect(pullRequests).toEqual([
        { url: 'https://github.com/owner/repo/pull/9', state: 'OPEN' },
        { url: 'https://github.com/owner/repo/pull/10', state: 'MERGED' },
      ]);
      expect(requestOf(fetchSpy, 0)).toEqual({
        url: GRAPHQL_URL,
        method: 'POST',
        body: {
          query: CLOSING_PULL_REQUESTS_QUERY,
          variables: { owner: 'owner', repo: 'repo', number: 3 },
        },
      });
    });
  });

  describe('updateProjectItemSingleSelectValue', () => {
    it('sends the single select mutation', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        jsonResponse({
          data: {
            updateProjectV2ItemFieldValue: { projectV2Item: { id: 'ITEM_1' } },
          },
        }),
      );

      await repositoryCreate().updateProjectItemSingleSelectValue({
        projectId: 'PVT_board',
        itemId: 'ITEM_1',
        fieldId: 'FIELD_story',
        optionId: 'OPT_feature_a',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(requestOf(fetchSpy, 0)).toEqual({
        url: GRAPHQL_URL,
        method: 'POST',
        body: {
          query: PROJECT_ITEM_SINGLE_SELECT_UPDATE_MUTATION,
          variables: {
            projectId: 'PVT_board',
            itemId: 'ITEM_1',
            fieldId: 'FIELD_story',
            optionId: 'OPT_feature_a',
          },
        },
      });
    });

    it('rejects when the mutation returns GraphQL errors', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        jsonResponse({
          data: null,
          errors: [{ type: 'FORBIDDEN', message: 'Write access denied' }],
        }),
      );

      await expect(
        repositoryCreate().updateProjectItemSingleSelectValue({
          projectId: 'PVT_board',
          itemId: 'ITEM_1',
          fieldId: 'FIELD_story',
          optionId: 'OPT_feature_a',
        }),
      ).rejects.toThrow('Write access denied');
    });
  });
});
