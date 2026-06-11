import { GitHubTriageRepository } from './GitHubTriageRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

const makeJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('GitHubTriageRepository', () => {
  let repository: GitHubTriageRepository;

  beforeEach(() => {
    jest.restoreAllMocks();
    repository = new GitHubTriageRepository(
      new LocalStorageRepository(),
      'test-token',
    );
  });

  describe('getTriageData', () => {
    const buildProjectResponse = (
      override: Record<string, unknown> = {},
    ): unknown => ({
      data: {
        organization: null,
        user: {
          projectV2: {
            id: 'project-id-1',
            fields: {
              nodes: [
                {
                  id: 'story-field-1',
                  name: 'Story',
                  options: [
                    { id: 'no-story-opt', name: 'No Story', color: 'GRAY' },
                    { id: 'story-opt-1', name: 'Feature A', color: 'BLUE' },
                    { id: 'story-opt-2', name: 'Feature B', color: 'GREEN' },
                  ],
                },
              ],
            },
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: 'item-1',
                  content: {
                    number: 1,
                    title: 'Untriaged issue',
                    body: 'Body text',
                    url: 'https://github.com/owner/repo/issues/1',
                    state: 'OPEN',
                    isPullRequest: 'Issue',
                  },
                  fieldValues: {
                    nodes: [
                      {
                        field: { id: 'story-field-1', name: 'Story' },
                        optionId: 'no-story-opt',
                      },
                    ],
                  },
                },
                {
                  id: 'item-2',
                  content: {
                    number: 2,
                    title: 'Story assigned issue',
                    body: '',
                    url: 'https://github.com/owner/repo/issues/2',
                    state: 'OPEN',
                    isPullRequest: 'Issue',
                  },
                  fieldValues: {
                    nodes: [
                      {
                        field: { id: 'story-field-1', name: 'Story' },
                        optionId: 'story-opt-1',
                      },
                    ],
                  },
                },
                {
                  id: 'item-3',
                  content: {
                    number: 3,
                    title: 'Closed issue',
                    body: '',
                    url: 'https://github.com/owner/repo/issues/3',
                    state: 'CLOSED',
                    isPullRequest: 'Issue',
                  },
                  fieldValues: { nodes: [] },
                },
                {
                  id: 'item-4',
                  content: {
                    number: 100,
                    title: 'A pull request',
                    body: '',
                    url: 'https://github.com/owner/repo/pull/100',
                    state: 'OPEN',
                    isPullRequest: 'PullRequest',
                  },
                  fieldValues: { nodes: [] },
                },
              ],
              ...override,
            },
          },
        },
      },
    });

    it('returns only open untriaged non-PR issues', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(makeJsonResponse(buildProjectResponse()));

      const result = await repository.getTriageData(
        'https://github.com/users/owner/projects/1',
      );

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].number).toBe(1);
      expect(result.issues[0].title).toBe('Untriaged issue');
      expect(result.issues[0].owner).toBe('owner');
      expect(result.issues[0].repo).toBe('repo');
      expect(result.storyFieldId).toBe('story-field-1');
      expect(result.projectId).toBe('project-id-1');
      expect(result.storyOptions).toHaveLength(2);
      expect(result.storyOptions[0].name).toBe('Feature A');
    });

    it('throws when Story field exists but no-story option is absent', async () => {
      const responseWithoutNoStory = {
        data: {
          organization: null,
          user: {
            projectV2: {
              id: 'project-id-1',
              fields: {
                nodes: [
                  {
                    id: 'story-field-1',
                    name: 'Story',
                    options: [
                      { id: 'story-opt-1', name: 'Feature A', color: 'BLUE' },
                    ],
                  },
                ],
              },
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [],
              },
            },
          },
        },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(makeJsonResponse(responseWithoutNoStory));

      await expect(
        repository.getTriageData('https://github.com/users/owner/projects/1'),
      ).rejects.toThrow("no 'No Story' option exists");
    });

    it('returns empty issues when no Story field found', async () => {
      const responseWithoutStory = {
        data: {
          organization: null,
          user: {
            projectV2: {
              id: 'project-id-1',
              fields: { nodes: [] },
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [],
              },
            },
          },
        },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(makeJsonResponse(responseWithoutStory));

      const result = await repository.getTriageData(
        'https://github.com/users/owner/projects/1',
      );

      expect(result.issues).toHaveLength(0);
      expect(result.storyOptions).toHaveLength(0);
      expect(result.storyFieldId).toBe('');
    });

    it('throws on GraphQL error in response', async () => {
      const errorResponse = {
        errors: [{ message: 'Field does not exist' }],
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(makeJsonResponse(errorResponse));

      await expect(
        repository.getTriageData('https://github.com/users/owner/projects/1'),
      ).rejects.toThrow('Field does not exist');
    });

    it('throws when project not found', async () => {
      const notFoundResponse = { data: { organization: null, user: null } };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(makeJsonResponse(notFoundResponse));

      await expect(
        repository.getTriageData('https://github.com/users/owner/projects/1'),
      ).rejects.toThrow('Project not found');
    });

    it('paginates when hasNextPage is true', async () => {
      const firstPage = buildProjectResponse({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
        nodes: [
          {
            id: 'item-pg1',
            content: {
              number: 10,
              title: 'Page 1 issue',
              body: '',
              url: 'https://github.com/owner/repo/issues/10',
              state: 'OPEN',
              isPullRequest: 'Issue',
            },
            fieldValues: { nodes: [] },
          },
        ],
      });
      const secondPage = {
        data: {
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: 'item-pg2',
                  content: {
                    number: 11,
                    title: 'Page 2 issue',
                    body: '',
                    url: 'https://github.com/owner/repo/issues/11',
                    state: 'OPEN',
                    isPullRequest: 'Issue',
                  },
                  fieldValues: { nodes: [] },
                },
              ],
            },
          },
        },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(makeJsonResponse(firstPage))
        .mockResolvedValueOnce(makeJsonResponse(secondPage));

      const result = await repository.getTriageData(
        'https://github.com/users/owner/projects/1',
      );

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].number).toBe(10);
      expect(result.issues[1].number).toBe(11);
    });
  });

  describe('setStory', () => {
    it('sends correct GraphQL mutation with variables', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        makeJsonResponse({
          data: { updateProjectV2ItemFieldValue: { clientMutationId: null } },
        }),
      );

      await repository.setStory('project-1', 'field-1', 'item-1', 'option-1');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callInit = fetchSpy.mock.calls[0][1];
      const callBodyStr =
        callInit && typeof callInit === 'object' && 'body' in callInit
          ? String(callInit.body)
          : '';
      const callBody: unknown = JSON.parse(callBodyStr);
      const variables =
        typeof callBody === 'object' &&
        callBody !== null &&
        'variables' in callBody
          ? callBody['variables']
          : undefined;
      expect(variables).toEqual({
        projectId: 'project-1',
        fieldId: 'field-1',
        itemId: 'item-1',
        optionId: 'option-1',
      });
    });

    it('throws on GraphQL error', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          makeJsonResponse({ errors: [{ message: 'Not authorized' }] }),
        );

      await expect(
        repository.setStory('project-1', 'field-1', 'item-1', 'option-1'),
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('closeIssue', () => {
    it('sends PATCH to correct URL with state and state_reason', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(makeJsonResponse({ state: 'closed' }));

      await repository.closeIssue('owner', 'repo', 42, 'completed');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callUrl = String(fetchSpy.mock.calls[0][0]);
      expect(callUrl).toContain('owner');
      expect(callUrl).toContain('repo');
      expect(callUrl).toContain('42');
      const callInit2 = fetchSpy.mock.calls[0][1];
      const callBodyStr2 =
        callInit2 && typeof callInit2 === 'object' && 'body' in callInit2
          ? String(callInit2.body)
          : '';
      const callBody2: unknown = JSON.parse(callBodyStr2);
      const state =
        typeof callBody2 === 'object' &&
        callBody2 !== null &&
        'state' in callBody2
          ? callBody2['state']
          : undefined;
      const stateReason =
        typeof callBody2 === 'object' &&
        callBody2 !== null &&
        'state_reason' in callBody2
          ? callBody2['state_reason']
          : undefined;
      expect(state).toBe('closed');
      expect(stateReason).toBe('completed');
    });

    it('throws for invalid owner name', async () => {
      await expect(
        repository.closeIssue('../evil', 'repo', 1, 'completed'),
      ).rejects.toThrow('Invalid owner or repo name');
    });

    it('throws for invalid repo name', async () => {
      await expect(
        repository.closeIssue('owner', 'r e p o', 1, 'completed'),
      ).rejects.toThrow('Invalid owner or repo name');
    });
  });
});
