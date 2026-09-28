import {
  PullRequestProjectItemRemoveUseCase,
  PullRequestProjectItemBackupRecord,
} from './PullRequestProjectItemRemoveUseCase';
import {
  ProjectItemRepository,
  ProjectItemSnapshot,
} from './adapter-interfaces/ProjectItemRepository';

type FakeProjectItemRepository = Pick<
  ProjectItemRepository,
  'fetchProjectItems' | 'removeItemFromProjectByIssueUrl'
>;

describe('PullRequestProjectItemRemoveUseCase', () => {
  let fetchProjectItems: jest.Mock<Promise<ProjectItemSnapshot[]>, [string]>;
  let removeItemFromProjectByIssueUrl: jest.Mock<
    Promise<void>,
    [string, string]
  >;
  let fakeProjectItemRepository: FakeProjectItemRepository;
  let useCase: PullRequestProjectItemRemoveUseCase;

  beforeEach(() => {
    fetchProjectItems = jest.fn();
    removeItemFromProjectByIssueUrl = jest.fn();
    fakeProjectItemRepository = {
      fetchProjectItems,
      removeItemFromProjectByIssueUrl,
    };
    useCase = new PullRequestProjectItemRemoveUseCase(
      fakeProjectItemRepository,
    );
  });

  describe('findPullRequestItems', () => {
    const issueItem: ProjectItemSnapshot = {
      id: 'ITEM_ISSUE_1',
      url: 'https://github.com/owner/repo/issues/1',
      customFields: [{ name: 'Status', value: 'Todo' }],
    };
    const pullRequestItemWithFields: ProjectItemSnapshot = {
      id: 'ITEM_PR_1',
      url: 'https://github.com/owner/repo/pull/2',
      customFields: [
        { name: 'Status', value: 'In Progress' },
        { name: 'Story', value: 'story-a' },
      ],
    };

    const testCases: {
      name: string;
      items: ProjectItemSnapshot[];
      expected: PullRequestProjectItemBackupRecord[];
    }[] = [
      {
        name: 'filters out issue items and keeps only pull-request items, mapping itemId/url/statusValue/storyValue',
        items: [issueItem, pullRequestItemWithFields],
        expected: [
          {
            itemId: 'ITEM_PR_1',
            url: 'https://github.com/owner/repo/pull/2',
            statusValue: 'In Progress',
            storyValue: 'story-a',
          },
        ],
      },
      {
        name: 'returns an empty array when no items are pull requests',
        items: [issueItem],
        expected: [],
      },
      {
        name: 'reads a lowercase "story" custom field name case-insensitively',
        items: [
          {
            id: 'ITEM_PR_2',
            url: 'https://github.com/owner/repo/pull/3',
            customFields: [
              { name: 'status', value: 'Done' },
              { name: 'story', value: 'story-b' },
            ],
          },
        ],
        expected: [
          {
            itemId: 'ITEM_PR_2',
            url: 'https://github.com/owner/repo/pull/3',
            statusValue: 'Done',
            storyValue: 'story-b',
          },
        ],
      },
      {
        name: 'reads a capitalized "Story" custom field name case-insensitively',
        items: [
          {
            id: 'ITEM_PR_3',
            url: 'https://github.com/owner/repo/pull/4',
            customFields: [
              { name: 'Status', value: 'Backlog' },
              { name: 'Story', value: 'story-c' },
            ],
          },
        ],
        expected: [
          {
            itemId: 'ITEM_PR_3',
            url: 'https://github.com/owner/repo/pull/4',
            statusValue: 'Backlog',
            storyValue: 'story-c',
          },
        ],
      },
      {
        name: 'returns statusValue and storyValue as null when both custom fields are absent',
        items: [
          {
            id: 'ITEM_PR_4',
            url: 'https://github.com/owner/repo/pull/5',
            customFields: [],
          },
        ],
        expected: [
          {
            itemId: 'ITEM_PR_4',
            url: 'https://github.com/owner/repo/pull/5',
            statusValue: null,
            storyValue: null,
          },
        ],
      },
      {
        name: 'returns statusValue and storyValue as null when the custom fields are present but their value is null',
        items: [
          {
            id: 'ITEM_PR_5',
            url: 'https://github.com/owner/repo/pull/6',
            customFields: [
              { name: 'Status', value: null },
              { name: 'Story', value: null },
            ],
          },
        ],
        expected: [
          {
            itemId: 'ITEM_PR_5',
            url: 'https://github.com/owner/repo/pull/6',
            statusValue: null,
            storyValue: null,
          },
        ],
      },
      {
        name: 'preserves the fetchProjectItems order across multiple matched pull-request items, dropping issue items entirely',
        items: [
          {
            id: 'ITEM_PR_FIRST',
            url: 'https://github.com/owner/repo/pull/10',
            customFields: [],
          },
          issueItem,
          {
            id: 'ITEM_PR_SECOND',
            url: 'https://github.com/owner/repo/pull/11',
            customFields: [],
          },
        ],
        expected: [
          {
            itemId: 'ITEM_PR_FIRST',
            url: 'https://github.com/owner/repo/pull/10',
            statusValue: null,
            storyValue: null,
          },
          {
            itemId: 'ITEM_PR_SECOND',
            url: 'https://github.com/owner/repo/pull/11',
            statusValue: null,
            storyValue: null,
          },
        ],
      },
    ];

    testCases.forEach(({ name, items, expected }) => {
      it(name, async () => {
        fetchProjectItems.mockResolvedValue(items);

        const result = await useCase.findPullRequestItems('PVT_test1');

        expect(result).toEqual(expected);
      });
    });

    it('calls fetchProjectItems with the given projectId', async () => {
      fetchProjectItems.mockResolvedValue([]);

      await useCase.findPullRequestItems('PVT_test2');

      expect(fetchProjectItems).toHaveBeenCalledWith('PVT_test2');
    });
  });

  describe('removeItems', () => {
    it('calls removeItemFromProjectByIssueUrl once per item with (url, projectId) and returns every url in succeededUrls when every call succeeds', async () => {
      removeItemFromProjectByIssueUrl.mockResolvedValue(undefined);

      const result = await useCase.removeItems('PVT_test3', [
        { url: 'https://github.com/owner/repo/pull/1' },
        { url: 'https://github.com/owner/repo/pull/2' },
      ]);

      expect(removeItemFromProjectByIssueUrl.mock.calls).toEqual([
        ['https://github.com/owner/repo/pull/1', 'PVT_test3'],
        ['https://github.com/owner/repo/pull/2', 'PVT_test3'],
      ]);
      expect(result).toEqual({
        succeededUrls: [
          'https://github.com/owner/repo/pull/1',
          'https://github.com/owner/repo/pull/2',
        ],
        failures: [],
      });
    });

    it('collects a failing item into failures with its error message, continues to remaining items, and still attempts every item after the failing one', async () => {
      removeItemFromProjectByIssueUrl.mockImplementation((url: string) => {
        if (url === 'https://github.com/owner/repo/pull/2') {
          return Promise.reject(new Error('deleteProjectV2Item failed: 500'));
        }
        return Promise.resolve(undefined);
      });

      const result = await useCase.removeItems('PVT_test4', [
        { url: 'https://github.com/owner/repo/pull/1' },
        { url: 'https://github.com/owner/repo/pull/2' },
        { url: 'https://github.com/owner/repo/pull/3' },
      ]);

      expect(removeItemFromProjectByIssueUrl.mock.calls).toEqual([
        ['https://github.com/owner/repo/pull/1', 'PVT_test4'],
        ['https://github.com/owner/repo/pull/2', 'PVT_test4'],
        ['https://github.com/owner/repo/pull/3', 'PVT_test4'],
      ]);
      expect(result).toEqual({
        succeededUrls: [
          'https://github.com/owner/repo/pull/1',
          'https://github.com/owner/repo/pull/3',
        ],
        failures: [
          {
            url: 'https://github.com/owner/repo/pull/2',
            error: 'deleteProjectV2Item failed: 500',
          },
        ],
      });
    });

    it('records String(error) in failures when the thrown/rejected value is not an Error instance', async () => {
      removeItemFromProjectByIssueUrl.mockRejectedValueOnce(
        'plain string failure',
      );

      const result = await useCase.removeItems('PVT_test5', [
        { url: 'https://github.com/owner/repo/pull/1' },
      ]);

      expect(result).toEqual({
        succeededUrls: [],
        failures: [
          {
            url: 'https://github.com/owner/repo/pull/1',
            error: 'plain string failure',
          },
        ],
      });
    });

    it('resolves with empty succeededUrls and failures when given an empty items array, without calling the repository', async () => {
      const result = await useCase.removeItems('PVT_test6', []);

      expect(removeItemFromProjectByIssueUrl).not.toHaveBeenCalled();
      expect(result).toEqual({ succeededUrls: [], failures: [] });
    });
  });
});
