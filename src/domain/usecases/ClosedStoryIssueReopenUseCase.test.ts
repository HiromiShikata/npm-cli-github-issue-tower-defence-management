import { ClosedStoryIssueReopenUseCase } from './ClosedStoryIssueReopenUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { StoryObject, StoryObjectMap } from '../entities/StoryObjectMap';
import { StoryOption } from '../entities/Project';
import { SearchedIssue } from '../entities/SearchedIssue';

type MockedRepository = {
  reopenIssueByUrl: jest.MockedFunction<IssueRepository['reopenIssueByUrl']>;
  searchIssues: jest.MockedFunction<IssueRepository['searchIssues']>;
  getIssueByUrl: jest.MockedFunction<IssueRepository['getIssueByUrl']>;
};

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'owner/repo',
  number: 1,
  title: 'feature / X',
  state: 'CLOSED',
  status: 'Done',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/owner/repo/issues/1',
  assignees: [],
  labels: ['story'],
  org: 'owner',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  author: '',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: 'COMPLETED',
  ...overrides,
});

const createMockSearchedIssue = (
  overrides: Partial<SearchedIssue> = {},
): SearchedIssue => ({
  url: 'https://github.com/owner/repo/issues/1',
  org: 'owner',
  repo: 'repo',
  number: 1,
  state: 'CLOSED',
  author: '',
  assignees: [],
  ...overrides,
});

const createStoryOption = (name: string): StoryOption => ({
  id: `story-${name}`,
  name,
  color: 'BLUE',
  description: '',
});

const buildStoryObjectMap = (
  entries: Array<{ storyName: string; storyIssue: Issue | null }>,
): StoryObjectMap => {
  const map: StoryObjectMap = new Map();
  for (const entry of entries) {
    const storyObject: StoryObject = {
      story: createStoryOption(entry.storyName),
      storyIssue: entry.storyIssue,
      issues: [],
    };
    map.set(entry.storyName, storyObject);
  }
  return map;
};

describe('ClosedStoryIssueReopenUseCase', () => {
  let mockRepository: MockedRepository;
  let useCase: ClosedStoryIssueReopenUseCase;

  beforeEach(() => {
    mockRepository = {
      reopenIssueByUrl: jest.fn().mockResolvedValue(undefined),
      searchIssues: jest.fn().mockResolvedValue([]),
      getIssueByUrl: jest.fn().mockResolvedValue(null),
    };
    useCase = new ClosedStoryIssueReopenUseCase(mockRepository);
  });

  const testCases: Array<{
    description: string;
    storyNames: string[];
    storyIssues: Array<Issue | null>;
    issues: Issue[];
    expectedReopenCallCount: number;
    expectedStoryIssueClosedState: Array<boolean | null>;
    expectedToThrow?: boolean;
  }> = [
    {
      description:
        'reopens closed story issue and updates storyIssue when story is non-regular and closed story issue with story label exists',
      storyNames: ['feature / X'],
      storyIssues: [null],
      issues: [
        createMockIssue({
          title: 'feature / X',
          isClosed: true,
          labels: ['story'],
        }),
      ],
      expectedReopenCallCount: 1,
      expectedStoryIssueClosedState: [false],
    },
    {
      description:
        'skips regular story even when closed story issue with story label exists',
      storyNames: ['regular / NO STORY'],
      storyIssues: [null],
      issues: [
        createMockIssue({
          title: 'regular / NO STORY',
          isClosed: true,
          labels: ['story'],
        }),
      ],
      expectedReopenCallCount: 0,
      expectedStoryIssueClosedState: [null],
    },
    {
      description: 'skips when storyIssue is already set (open issue exists)',
      storyNames: ['feature / X'],
      storyIssues: [
        createMockIssue({ isClosed: false, state: 'OPEN', stateReason: null }),
      ],
      issues: [
        createMockIssue({
          title: 'feature / X',
          isClosed: true,
          labels: ['story'],
        }),
      ],
      expectedReopenCallCount: 0,
      expectedStoryIssueClosedState: [false],
    },
    {
      description: 'skips when matching closed issue has no story label',
      storyNames: ['feature / X'],
      storyIssues: [null],
      issues: [
        createMockIssue({ title: 'feature / X', isClosed: true, labels: [] }),
      ],
      expectedReopenCallCount: 0,
      expectedStoryIssueClosedState: [null],
    },
    {
      description: 'does nothing when no matching closed issue found',
      storyNames: ['feature / X'],
      storyIssues: [null],
      issues: [],
      expectedReopenCallCount: 0,
      expectedStoryIssueClosedState: [null],
    },
    {
      description:
        'reopens both closed story issues when two non-regular stories each have a closed story issue',
      storyNames: ['feature / X', 'feature / Y'],
      storyIssues: [null, null],
      issues: [
        createMockIssue({
          title: 'feature / X',
          url: 'https://github.com/owner/repo/issues/1',
          isClosed: true,
          labels: ['story'],
        }),
        createMockIssue({
          title: 'feature / Y',
          url: 'https://github.com/owner/repo/issues/2',
          number: 2,
          isClosed: true,
          labels: ['story'],
        }),
      ],
      expectedReopenCallCount: 2,
      expectedStoryIssueClosedState: [false, false],
    },
    {
      description:
        'throws AggregateError and leaves storyIssue null when reopenIssueByUrl throws',
      storyNames: ['feature / X'],
      storyIssues: [null],
      issues: [
        createMockIssue({
          title: 'feature / X',
          isClosed: true,
          labels: ['story'],
        }),
      ],
      expectedReopenCallCount: 1,
      expectedStoryIssueClosedState: [null],
      expectedToThrow: true,
    },
  ];

  testCases.forEach((tc) => {
    it(tc.description, async () => {
      if (tc.expectedToThrow) {
        mockRepository.reopenIssueByUrl.mockRejectedValue(
          new Error('API error'),
        );
      }

      const storyObjectMap = buildStoryObjectMap(
        tc.storyNames.map((name, i) => ({
          storyName: name,
          storyIssue: tc.storyIssues[i],
        })),
      );

      if (tc.expectedToThrow) {
        await expect(
          useCase.run({
            issues: tc.issues,
            storyObjectMap,
            storyIssueOwnerRepo: 'owner/repo',
          }),
        ).rejects.toBeInstanceOf(AggregateError);
      } else {
        await useCase.run({
          issues: tc.issues,
          storyObjectMap,
          storyIssueOwnerRepo: 'owner/repo',
        });
      }

      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(
        tc.expectedReopenCallCount,
      );

      tc.storyNames.forEach((name, i) => {
        const storyObject = storyObjectMap.get(name);
        const expectedClosed = tc.expectedStoryIssueClosedState[i];
        if (expectedClosed === null) {
          expect(storyObject?.storyIssue).toBeNull();
        } else {
          expect(storyObject?.storyIssue?.isClosed).toBe(expectedClosed);
        }
      });
    });
  });

  describe('archived issue fallback via searchIssues', () => {
    it('reopens archived closed story issue via searchIssues when not found in params.issues', async () => {
      const archivedIssue = createMockIssue({
        title: 'feature / X',
        url: 'https://github.com/owner/repo/issues/42',
        number: 42,
        isClosed: true,
        labels: ['story'],
      });
      mockRepository.searchIssues.mockResolvedValue([
        createMockSearchedIssue({
          url: 'https://github.com/owner/repo/issues/42',
          number: 42,
        }),
      ]);
      mockRepository.getIssueByUrl.mockResolvedValue(archivedIssue);

      const storyObjectMap = buildStoryObjectMap([
        { storyName: 'feature / X', storyIssue: null },
      ]);

      await useCase.run({
        issues: [],
        storyObjectMap,
        storyIssueOwnerRepo: 'owner/repo',
      });

      expect(mockRepository.searchIssues).toHaveBeenCalledWith(
        'repo:owner/repo is:closed label:story "feature / X" in:title',
      );
      expect(mockRepository.getIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/owner/repo/issues/42',
      );
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/owner/repo/issues/42',
      );
      const storyObject = storyObjectMap.get('feature / X');
      expect(storyObject?.storyIssue?.isClosed).toBe(false);
      expect(storyObject?.storyIssue?.url).toBe(
        'https://github.com/owner/repo/issues/42',
      );
    });

    it('does not call searchIssues when closed story issue already found in params.issues', async () => {
      const storyObjectMap = buildStoryObjectMap([
        { storyName: 'feature / X', storyIssue: null },
      ]);

      await useCase.run({
        issues: [
          createMockIssue({
            title: 'feature / X',
            isClosed: true,
            labels: ['story'],
          }),
        ],
        storyObjectMap,
        storyIssueOwnerRepo: 'owner/repo',
      });

      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
    });

    it('skips reopen when searchIssues returns empty results for archived story', async () => {
      mockRepository.searchIssues.mockResolvedValue([]);

      const storyObjectMap = buildStoryObjectMap([
        { storyName: 'feature / X', storyIssue: null },
      ]);

      await useCase.run({
        issues: [],
        storyObjectMap,
        storyIssueOwnerRepo: 'owner/repo',
      });

      expect(mockRepository.searchIssues).toHaveBeenCalledTimes(1);
      expect(mockRepository.getIssueByUrl).not.toHaveBeenCalled();
      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyObjectMap.get('feature / X')?.storyIssue).toBeNull();
    });

    it('skips reopen when getIssueByUrl returns null for search result', async () => {
      mockRepository.searchIssues.mockResolvedValue([
        createMockSearchedIssue({
          url: 'https://github.com/owner/repo/issues/42',
        }),
      ]);
      mockRepository.getIssueByUrl.mockResolvedValue(null);

      const storyObjectMap = buildStoryObjectMap([
        { storyName: 'feature / X', storyIssue: null },
      ]);

      await useCase.run({
        issues: [],
        storyObjectMap,
        storyIssueOwnerRepo: 'owner/repo',
      });

      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyObjectMap.get('feature / X')?.storyIssue).toBeNull();
    });

    it('skips reopen when search result issue is not closed', async () => {
      mockRepository.searchIssues.mockResolvedValue([
        createMockSearchedIssue({
          url: 'https://github.com/owner/repo/issues/42',
        }),
      ]);
      mockRepository.getIssueByUrl.mockResolvedValue(
        createMockIssue({
          title: 'feature / X',
          isClosed: false,
          state: 'OPEN',
          labels: ['story'],
        }),
      );

      const storyObjectMap = buildStoryObjectMap([
        { storyName: 'feature / X', storyIssue: null },
      ]);

      await useCase.run({
        issues: [],
        storyObjectMap,
        storyIssueOwnerRepo: 'owner/repo',
      });

      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyObjectMap.get('feature / X')?.storyIssue).toBeNull();
    });

    it('skips reopen when search result issue has no story label', async () => {
      mockRepository.searchIssues.mockResolvedValue([
        createMockSearchedIssue({
          url: 'https://github.com/owner/repo/issues/42',
        }),
      ]);
      mockRepository.getIssueByUrl.mockResolvedValue(
        createMockIssue({
          title: 'feature / X',
          isClosed: true,
          labels: [],
        }),
      );

      const storyObjectMap = buildStoryObjectMap([
        { storyName: 'feature / X', storyIssue: null },
      ]);

      await useCase.run({
        issues: [],
        storyObjectMap,
        storyIssueOwnerRepo: 'owner/repo',
      });

      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyObjectMap.get('feature / X')?.storyIssue).toBeNull();
    });

    it('throws AggregateError when reopenIssueByUrl throws for archived issue found via searchIssues', async () => {
      const archivedIssue = createMockIssue({
        title: 'feature / X',
        url: 'https://github.com/owner/repo/issues/42',
        number: 42,
        isClosed: true,
        labels: ['story'],
      });
      mockRepository.searchIssues.mockResolvedValue([
        createMockSearchedIssue({
          url: 'https://github.com/owner/repo/issues/42',
          number: 42,
        }),
      ]);
      mockRepository.getIssueByUrl.mockResolvedValue(archivedIssue);
      mockRepository.reopenIssueByUrl.mockRejectedValue(new Error('API error'));

      const storyObjectMap = buildStoryObjectMap([
        { storyName: 'feature / X', storyIssue: null },
      ]);

      await expect(
        useCase.run({
          issues: [],
          storyObjectMap,
          storyIssueOwnerRepo: 'owner/repo',
        }),
      ).rejects.toBeInstanceOf(AggregateError);

      expect(storyObjectMap.get('feature / X')?.storyIssue).toBeNull();
    });
  });
});
