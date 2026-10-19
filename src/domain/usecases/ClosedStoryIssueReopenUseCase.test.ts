import { ClosedStoryIssueReopenUseCase } from './ClosedStoryIssueReopenUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { StoryObject, StoryObjectMap } from '../entities/StoryObjectMap';
import { StoryOption } from '../entities/Project';

type MockedRepository = {
  reopenIssueByUrl: jest.MockedFunction<IssueRepository['reopenIssueByUrl']>;
  searchIssues: jest.MockedFunction<IssueRepository['searchIssues']>;
  getIssueByUrl: jest.MockedFunction<IssueRepository['getIssueByUrl']>;
  getIssueSummariesByLabelAndState: jest.MockedFunction<
    IssueRepository['getIssueSummariesByLabelAndState']
  >;
};

type StoryIssueSummary = { url: string; title: string };

const buildStoryIssueListParams = (state: 'open' | 'closed') => ({
  owner: 'owner',
  repositoryName: 'repo',
  label: 'story',
  state,
});

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
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: 'COMPLETED',
  ...overrides,
});

const createStoryOption = (name: string): StoryOption => ({
  id: `story-${name}`,
  name,
  color: 'BLUE',
  description: '',
});

const buildStoryObjectMapFixture = (
  entries: Array<{ storyName: string; storyIssue: Issue | null }>,
): StoryObjectMap => {
  const map: StoryObjectMap = new Map();
  for (const entry of entries) {
    const storyObject: StoryObject = {
      story: createStoryOption(entry.storyName),
      storyIssue: entry.storyIssue,
      issues: [],
    };
    map.set(storyObject.story.id, storyObject);
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
      getIssueSummariesByLabelAndState: jest.fn().mockResolvedValue([]),
    };
    useCase = new ClosedStoryIssueReopenUseCase(mockRepository);
  });

  const serveStoryIssueLists = (lists: {
    open: StoryIssueSummary[];
    closed: StoryIssueSummary[];
  }): void => {
    mockRepository.getIssueSummariesByLabelAndState.mockImplementation(
      async ({ state }) => lists[state],
    );
  };

  const countStoryIssueListCalls = (state: 'open' | 'closed'): number =>
    mockRepository.getIssueSummariesByLabelAndState.mock.calls.filter(
      ([params]) => params.state === state,
    ).length;

  const serveLiveIssues = (
    liveIssuesByUrl: Map<string, Issue | null>,
  ): void => {
    mockRepository.getIssueByUrl.mockImplementation(
      async (url: string) => liveIssuesByUrl.get(url) ?? null,
    );
  };

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

      const storyObjectMap = buildStoryObjectMapFixture(
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
        const storyObject = storyObjectMap.get(createStoryOption(name).id);
        const expectedClosed = tc.expectedStoryIssueClosedState[i];
        if (expectedClosed === null) {
          expect(storyObject?.storyIssue).toBeNull();
        } else {
          expect(storyObject?.storyIssue?.isClosed).toBe(expectedClosed);
        }
      });
    });
  });

  const closedStoryIssueUrl = 'https://github.com/owner/repo/issues/42';

  const buildClosedStoryIssue = (overrides: Partial<Issue> = {}): Issue =>
    createMockIssue({
      title: 'feature / X',
      url: closedStoryIssueUrl,
      number: 42,
      isClosed: true,
      labels: ['story'],
      ...overrides,
    });

  const storyIssueOf = (
    storyObjectMap: StoryObjectMap,
    storyName: string,
  ): Issue | null | undefined =>
    storyObjectMap.get(createStoryOption(storyName).id)?.storyIssue;

  const runWithStories = async (
    storyNames: string[],
    issues: Issue[] = [],
  ): Promise<{ storyObjectMap: StoryObjectMap; reopenedCount: number }> => {
    const storyObjectMap = buildStoryObjectMapFixture(
      storyNames.map((storyName) => ({ storyName, storyIssue: null })),
    );
    const reopenedCount = await useCase.run({
      issues,
      storyObjectMap,
      storyIssueOwnerRepo: 'owner/repo',
    });
    return { storyObjectMap, reopenedCount };
  };

  describe('archived issue fallback via the closed story list', () => {
    it('reopens archived closed story issue found in the closed story list when not found in params.issues', async () => {
      serveStoryIssueLists({
        open: [],
        closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
      });
      mockRepository.getIssueByUrl.mockResolvedValue(buildClosedStoryIssue());

      const { storyObjectMap } = await runWithStories(['feature / X']);

      expect(
        mockRepository.getIssueSummariesByLabelAndState,
      ).toHaveBeenCalledWith(buildStoryIssueListParams('closed'));
      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
      expect(mockRepository.getIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );
      expect(storyIssueOf(storyObjectMap, 'feature / X')?.isClosed).toBe(false);
      expect(storyIssueOf(storyObjectMap, 'feature / X')?.url).toBe(
        closedStoryIssueUrl,
      );
    });

    it('does not call the story list or searchIssues when closed story issue already found in params.issues', async () => {
      await runWithStories(
        ['feature / X'],
        [
          createMockIssue({
            title: 'feature / X',
            isClosed: true,
            labels: ['story'],
          }),
        ],
      );

      expect(
        mockRepository.getIssueSummariesByLabelAndState,
      ).not.toHaveBeenCalled();
      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
    });

    it('skips reopen when the closed story list is empty for archived story', async () => {
      serveStoryIssueLists({ open: [], closed: [] });

      const { storyObjectMap } = await runWithStories(['feature / X']);

      expect(countStoryIssueListCalls('closed')).toBe(1);
      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
      expect(mockRepository.getIssueByUrl).not.toHaveBeenCalled();
      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
    });

    it('skips reopen when getIssueByUrl returns null for the closed story list hit', async () => {
      serveStoryIssueLists({
        open: [],
        closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
      });
      mockRepository.getIssueByUrl.mockResolvedValue(null);

      const { storyObjectMap } = await runWithStories(['feature / X']);

      expect(mockRepository.getIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );
      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
    });

    it('skips reopen when the closed story list hit is not closed on live verification', async () => {
      serveStoryIssueLists({
        open: [],
        closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
      });
      mockRepository.getIssueByUrl.mockResolvedValue(
        createMockIssue({
          title: 'feature / X',
          isClosed: false,
          state: 'OPEN',
          labels: ['story'],
        }),
      );

      const { storyObjectMap } = await runWithStories(['feature / X']);

      expect(mockRepository.getIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );
      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
    });

    it('skips reopen when the closed story list hit has no story label on live verification', async () => {
      serveStoryIssueLists({
        open: [],
        closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
      });
      mockRepository.getIssueByUrl.mockResolvedValue(
        createMockIssue({
          title: 'feature / X',
          isClosed: true,
          labels: [],
        }),
      );

      const { storyObjectMap } = await runWithStories(['feature / X']);

      expect(mockRepository.getIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );
      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
    });

    it('throws AggregateError when reopenIssueByUrl throws for archived issue found in the closed story list', async () => {
      serveStoryIssueLists({
        open: [],
        closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
      });
      mockRepository.getIssueByUrl.mockResolvedValue(buildClosedStoryIssue());
      mockRepository.reopenIssueByUrl.mockRejectedValue(new Error('API error'));

      await expect(runWithStories(['feature / X'])).rejects.toBeInstanceOf(
        AggregateError,
      );

      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );
    });
  });

  describe('open story issue check before the closed story lookup', () => {
    it('skips reopening and does not look up the closed story list when the open story list holds an issue titled exactly the story name', async () => {
      serveStoryIssueLists({
        open: [
          {
            url: 'https://github.com/owner/repo/issues/43',
            title: 'feature / X',
          },
        ],
        closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
      });
      mockRepository.getIssueByUrl.mockResolvedValue(buildClosedStoryIssue());

      const { storyObjectMap } = await runWithStories(['feature / X']);

      expect(
        mockRepository.getIssueSummariesByLabelAndState,
      ).toHaveBeenCalledWith(buildStoryIssueListParams('open'));
      expect(countStoryIssueListCalls('closed')).toBe(0);
      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
    });

    it('looks up the open story list once and the closed story list once and never checks getIssueByUrl or reopenIssueByUrl when there is no cache match and neither list holds the story', async () => {
      serveStoryIssueLists({ open: [], closed: [] });

      const { storyObjectMap } = await runWithStories(['feature / X']);

      expect(countStoryIssueListCalls('open')).toBe(1);
      expect(countStoryIssueListCalls('closed')).toBe(1);
      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
      expect(mockRepository.getIssueByUrl).not.toHaveBeenCalled();
      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
    });

    const reopenWhenOpenListHasNoExactTitleTestCases: Array<{
      description: string;
      openList: StoryIssueSummary[];
    }> = [
      {
        description: 'open story list is empty',
        openList: [],
      },
      {
        description: 'open story list holds only an issue with a longer title',
        openList: [
          {
            url: 'https://github.com/owner/repo/issues/99',
            title: 'feature / X (copy)',
          },
        ],
      },
      {
        description:
          'open story list holds only an issue whose title differs in letter case',
        openList: [
          {
            url: 'https://github.com/owner/repo/issues/99',
            title: 'Feature / X',
          },
        ],
      },
      {
        description:
          'open story list holds only an issue whose title is a prefix of the story name',
        openList: [
          { url: 'https://github.com/owner/repo/issues/99', title: 'feature' },
        ],
      },
    ];

    reopenWhenOpenListHasNoExactTitleTestCases.forEach((tc) => {
      it(`reopens the archived closed duplicate found in the closed story list when the open story list has no issue titled exactly the story name (${tc.description})`, async () => {
        serveStoryIssueLists({
          open: tc.openList,
          closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
        });
        mockRepository.getIssueByUrl.mockResolvedValue(buildClosedStoryIssue());

        const { storyObjectMap } = await runWithStories(['feature / X']);

        expect(
          mockRepository.getIssueSummariesByLabelAndState,
        ).toHaveBeenCalledWith(buildStoryIssueListParams('open'));
        expect(
          mockRepository.getIssueSummariesByLabelAndState,
        ).toHaveBeenCalledWith(buildStoryIssueListParams('closed'));
        expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
          closedStoryIssueUrl,
        );
        expect(storyIssueOf(storyObjectMap, 'feature / X')?.isClosed).toBe(
          false,
        );
      });
    });
  });

  describe('cross-cycle duplicate prevention', () => {
    it('does not reopen a second closed duplicate story issue on the next cycle once the first reopened issue is open', async () => {
      serveStoryIssueLists({
        open: [],
        closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
      });
      serveLiveIssues(
        new Map([[closedStoryIssueUrl, buildClosedStoryIssue()]]),
      );

      await runWithStories(['feature / X']);

      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );

      serveStoryIssueLists({
        open: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
        closed: [
          {
            url: 'https://github.com/owner/repo/issues/43',
            title: 'feature / X',
          },
        ],
      });
      serveLiveIssues(
        new Map([
          [
            closedStoryIssueUrl,
            buildClosedStoryIssue({
              isClosed: false,
              state: 'OPEN',
              stateReason: null,
            }),
          ],
          [
            'https://github.com/owner/repo/issues/43',
            buildClosedStoryIssue({
              url: 'https://github.com/owner/repo/issues/43',
              number: 43,
            }),
          ],
        ]),
      );

      await runWithStories(['feature / X']);

      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalledWith(
        'https://github.com/owner/repo/issues/43',
      );
      expect(countStoryIssueListCalls('closed')).toBe(1);
      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
    });
  });

  describe('list-based story issue lookup', () => {
    it('reopens the closed story issue for a story without an open story issue', async () => {
      serveStoryIssueLists({
        open: [
          {
            url: 'https://github.com/owner/repo/issues/7',
            title: 'feature / Y',
          },
        ],
        closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
      });
      serveLiveIssues(
        new Map([[closedStoryIssueUrl, buildClosedStoryIssue()]]),
      );

      const { storyObjectMap, reopenedCount } = await runWithStories([
        'feature / X',
      ]);

      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );
      expect(reopenedCount).toBe(1);
      expect(storyIssueOf(storyObjectMap, 'feature / X')?.isClosed).toBe(false);
      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
    });

    it('consults the open story list once and the closed story list once per run for two stories without an open story issue', async () => {
      const issueUrlOfY = 'https://github.com/owner/repo/issues/52';
      serveStoryIssueLists({
        open: [],
        closed: [
          { url: issueUrlOfY, title: 'feature / Y' },
          { url: closedStoryIssueUrl, title: 'feature / X' },
        ],
      });
      serveLiveIssues(
        new Map([
          [closedStoryIssueUrl, buildClosedStoryIssue()],
          [
            issueUrlOfY,
            buildClosedStoryIssue({
              title: 'feature / Y',
              url: issueUrlOfY,
              number: 52,
            }),
          ],
        ]),
      );

      const { reopenedCount } = await runWithStories([
        'feature / X',
        'feature / Y',
      ]);

      expect(countStoryIssueListCalls('open')).toBe(1);
      expect(countStoryIssueListCalls('closed')).toBe(1);
      expect(mockRepository.searchIssues).not.toHaveBeenCalled();
      expect(reopenedCount).toBe(2);
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(2);
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
        closedStoryIssueUrl,
      );
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(issueUrlOfY);
    });

    const noClosedListLookupTestCases: Array<{
      description: string;
      storyEntries: Array<{ storyName: string; storyIssue: Issue | null }>;
      issues: Issue[];
      openList: StoryIssueSummary[];
      expectedReopenCallCount: number;
    }> = [
      {
        description: 'every story already has a story issue',
        storyEntries: [
          {
            storyName: 'feature / X',
            storyIssue: createMockIssue({
              isClosed: false,
              state: 'OPEN',
              stateReason: null,
            }),
          },
        ],
        issues: [],
        openList: [],
        expectedReopenCallCount: 0,
      },
      {
        description: 'every story is a regular story',
        storyEntries: [{ storyName: 'regular / NO STORY', storyIssue: null }],
        issues: [],
        openList: [],
        expectedReopenCallCount: 0,
      },
      {
        description:
          'every story has a closed story issue among the project issues',
        storyEntries: [{ storyName: 'feature / X', storyIssue: null }],
        issues: [
          createMockIssue({
            title: 'feature / X',
            isClosed: true,
            labels: ['story'],
          }),
        ],
        openList: [],
        expectedReopenCallCount: 1,
      },
      {
        description:
          'every story has an open story issue titled exactly the story name',
        storyEntries: [
          { storyName: 'feature / X', storyIssue: null },
          { storyName: 'feature / Y', storyIssue: null },
        ],
        issues: [],
        openList: [
          {
            url: 'https://github.com/owner/repo/issues/8',
            title: 'feature / Y',
          },
          {
            url: 'https://github.com/owner/repo/issues/7',
            title: 'feature / X',
          },
        ],
        expectedReopenCallCount: 0,
      },
    ];

    noClosedListLookupTestCases.forEach((tc) => {
      it(`does not consult the closed story list and consults the open story list at most once when ${tc.description}`, async () => {
        serveStoryIssueLists({
          open: tc.openList,
          closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
        });
        const storyObjectMap = buildStoryObjectMapFixture(tc.storyEntries);

        await useCase.run({
          issues: tc.issues,
          storyObjectMap,
          storyIssueOwnerRepo: 'owner/repo',
        });

        expect(countStoryIssueListCalls('closed')).toBe(0);
        expect(countStoryIssueListCalls('open')).toBeLessThanOrEqual(1);
        expect(mockRepository.searchIssues).not.toHaveBeenCalled();
        expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(
          tc.expectedReopenCallCount,
        );
      });
    });

    it('skips only the story with an open story issue and reopens the other story from a single closed story list lookup', async () => {
      const issueUrlOfY = 'https://github.com/owner/repo/issues/52';
      serveStoryIssueLists({
        open: [
          {
            url: 'https://github.com/owner/repo/issues/7',
            title: 'feature / X',
          },
        ],
        closed: [
          { url: issueUrlOfY, title: 'feature / Y' },
          { url: closedStoryIssueUrl, title: 'feature / X' },
        ],
      });
      serveLiveIssues(
        new Map([
          [closedStoryIssueUrl, buildClosedStoryIssue()],
          [
            issueUrlOfY,
            buildClosedStoryIssue({
              title: 'feature / Y',
              url: issueUrlOfY,
              number: 52,
            }),
          ],
        ]),
      );

      const { storyObjectMap, reopenedCount } = await runWithStories([
        'feature / X',
        'feature / Y',
      ]);

      expect(countStoryIssueListCalls('closed')).toBe(1);
      expect(reopenedCount).toBe(1);
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(issueUrlOfY);
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
      expect(storyIssueOf(storyObjectMap, 'feature / Y')?.url).toBe(
        issueUrlOfY,
      );
    });

    const closedListTitleMatchingTestCases: Array<{
      description: string;
      closedList: StoryIssueSummary[];
      expectedLiveCheckedUrl: string | null;
    }> = [
      {
        description: 'a longer title containing the story name',
        closedList: [{ url: closedStoryIssueUrl, title: 'feature / X (copy)' }],
        expectedLiveCheckedUrl: null,
      },
      {
        description: 'a title differing in letter case',
        closedList: [{ url: closedStoryIssueUrl, title: 'Feature / X' }],
        expectedLiveCheckedUrl: null,
      },
      {
        description: 'a title that is a prefix of the story name',
        closedList: [{ url: closedStoryIssueUrl, title: 'feature' }],
        expectedLiveCheckedUrl: null,
      },
      {
        description: 'a title with a trailing space',
        closedList: [{ url: closedStoryIssueUrl, title: 'feature / X ' }],
        expectedLiveCheckedUrl: null,
      },
      {
        description: 'an exact title listed after titles that do not match',
        closedList: [
          {
            url: 'https://github.com/owner/repo/issues/50',
            title: 'feature / X (copy)',
          },
          { url: closedStoryIssueUrl, title: 'feature / X' },
        ],
        expectedLiveCheckedUrl: closedStoryIssueUrl,
      },
      {
        description: 'two exact titles where the first in list order is used',
        closedList: [
          {
            url: 'https://github.com/owner/repo/issues/50',
            title: 'feature / X',
          },
          { url: closedStoryIssueUrl, title: 'feature / X' },
        ],
        expectedLiveCheckedUrl: 'https://github.com/owner/repo/issues/50',
      },
    ];

    closedListTitleMatchingTestCases.forEach((tc) => {
      it(`matches the closed story list by exact title and takes the first hit in list order (${tc.description})`, async () => {
        serveStoryIssueLists({ open: [], closed: tc.closedList });
        serveLiveIssues(
          new Map([
            [closedStoryIssueUrl, buildClosedStoryIssue()],
            [
              'https://github.com/owner/repo/issues/50',
              buildClosedStoryIssue({
                url: 'https://github.com/owner/repo/issues/50',
                number: 50,
              }),
            ],
          ]),
        );

        await runWithStories(['feature / X']);

        expect(countStoryIssueListCalls('closed')).toBe(1);
        if (tc.expectedLiveCheckedUrl === null) {
          expect(mockRepository.getIssueByUrl).not.toHaveBeenCalled();
          expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
        } else {
          expect(mockRepository.getIssueByUrl).toHaveBeenCalledTimes(1);
          expect(mockRepository.getIssueByUrl).toHaveBeenCalledWith(
            tc.expectedLiveCheckedUrl,
          );
          expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
          expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
            tc.expectedLiveCheckedUrl,
          );
        }
      });
    });

    const firstHitLiveVerificationFailureTestCases: Array<{
      description: string;
      liveIssueOfFirstHit: Issue | null;
    }> = [
      {
        description: 'the first hit cannot be fetched',
        liveIssueOfFirstHit: null,
      },
      {
        description: 'the first hit is not closed',
        liveIssueOfFirstHit: buildClosedStoryIssue({
          url: 'https://github.com/owner/repo/issues/50',
          number: 50,
          isClosed: false,
          state: 'OPEN',
          stateReason: null,
        }),
      },
      {
        description: 'the first hit has no story label',
        liveIssueOfFirstHit: buildClosedStoryIssue({
          url: 'https://github.com/owner/repo/issues/50',
          number: 50,
          labels: [],
        }),
      },
    ];

    firstHitLiveVerificationFailureTestCases.forEach((tc) => {
      it(`does not fall through to a later exact-title hit when ${tc.description}`, async () => {
        serveStoryIssueLists({
          open: [],
          closed: [
            {
              url: 'https://github.com/owner/repo/issues/50',
              title: 'feature / X',
            },
            { url: closedStoryIssueUrl, title: 'feature / X' },
          ],
        });
        serveLiveIssues(
          new Map([
            [closedStoryIssueUrl, buildClosedStoryIssue()],
            ['https://github.com/owner/repo/issues/50', tc.liveIssueOfFirstHit],
          ]),
        );

        const { storyObjectMap } = await runWithStories(['feature / X']);

        expect(mockRepository.getIssueByUrl).toHaveBeenCalledTimes(1);
        expect(mockRepository.getIssueByUrl).toHaveBeenCalledWith(
          'https://github.com/owner/repo/issues/50',
        );
        expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
        expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
      });
    });

    it.each([
      { failingState: 'open' as const },
      { failingState: 'closed' as const },
    ])(
      'rejects and reopens nothing when the $failingState story list lookup fails',
      async ({ failingState }) => {
        const listsOfHealthyStates = {
          open: [],
          closed: [{ url: closedStoryIssueUrl, title: 'feature / X' }],
        };
        mockRepository.getIssueSummariesByLabelAndState.mockImplementation(
          async ({ state }) => {
            if (state === failingState) {
              throw new Error('story list unavailable');
            }
            return listsOfHealthyStates[state];
          },
        );
        serveLiveIssues(
          new Map([[closedStoryIssueUrl, buildClosedStoryIssue()]]),
        );

        await expect(runWithStories(['feature / X'])).rejects.toThrow();

        expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
        expect(mockRepository.searchIssues).not.toHaveBeenCalled();
      },
    );
  });

  describe('reopen of a closed story issue found among the project issues', () => {
    it('returns the number of reopened story issues', async () => {
      const { reopenedCount } = await runWithStories(
        ['feature / X', 'feature / Y', 'regular / NO STORY'],
        [
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
          createMockIssue({
            title: 'regular / NO STORY',
            url: 'https://github.com/owner/repo/issues/3',
            number: 3,
            isClosed: true,
            labels: ['story'],
          }),
        ],
      );

      expect(reopenedCount).toBe(2);
    });

    it('stores the reopened issue with an open state, REOPENED reason and not closed on the story object', async () => {
      const closedIssue = createMockIssue({
        title: 'feature / X',
        isClosed: true,
        state: 'CLOSED',
        stateReason: 'COMPLETED',
        labels: ['story'],
      });

      const { storyObjectMap } = await runWithStories(
        ['feature / X'],
        [closedIssue],
      );

      expect(storyIssueOf(storyObjectMap, 'feature / X')).toEqual({
        ...closedIssue,
        isClosed: false,
        state: 'OPEN',
        stateReason: 'REOPENED',
      });
    });

    it('reopens the first matching closed issue in params.issues order when two closed issues match the story name', async () => {
      await runWithStories(
        ['feature / X'],
        [
          createMockIssue({
            title: 'feature / X',
            url: 'https://github.com/owner/repo/issues/1',
            isClosed: true,
            labels: ['story'],
          }),
          createMockIssue({
            title: 'feature / X',
            url: 'https://github.com/owner/repo/issues/2',
            number: 2,
            isClosed: true,
            labels: ['story'],
          }),
        ],
      );

      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/owner/repo/issues/1',
      );
    });

    it('reopens a closed issue among the project issues whose title is a prefix of the story name', async () => {
      await runWithStories(
        ['feature / X'],
        [
          createMockIssue({
            title: 'feature',
            isClosed: true,
            labels: ['story'],
          }),
        ],
      );

      expect(mockRepository.reopenIssueByUrl).toHaveBeenCalledTimes(1);
    });

    it('does not reopen an issue among the project issues that is not closed', async () => {
      const { storyObjectMap } = await runWithStories(
        ['feature / X'],
        [
          createMockIssue({
            title: 'feature / X',
            isClosed: false,
            state: 'OPEN',
            labels: ['story'],
          }),
        ],
      );

      expect(mockRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
    });

    it('continues with the remaining stories and aggregates every reopen error when reopenIssueByUrl fails', async () => {
      const reopenFailureOfX = new Error('reopen failed for X');
      const reopenFailureOfZ = new Error('reopen failed for Z');
      mockRepository.reopenIssueByUrl.mockImplementation(
        async (url: string) => {
          if (url === 'https://github.com/owner/repo/issues/1') {
            throw reopenFailureOfX;
          }
          if (url === 'https://github.com/owner/repo/issues/3') {
            throw reopenFailureOfZ;
          }
        },
      );
      const storyObjectMap = buildStoryObjectMapFixture([
        { storyName: 'feature / X', storyIssue: null },
        { storyName: 'feature / Y', storyIssue: null },
        { storyName: 'feature / Z', storyIssue: null },
      ]);

      const failure = await useCase
        .run({
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
            createMockIssue({
              title: 'feature / Z',
              url: 'https://github.com/owner/repo/issues/3',
              number: 3,
              isClosed: true,
              labels: ['story'],
            }),
          ],
          storyObjectMap,
          storyIssueOwnerRepo: 'owner/repo',
        })
        .then(
          () => null,
          (error: unknown) => error,
        );

      expect(failure).toBeInstanceOf(AggregateError);
      expect(failure).toHaveProperty(
        'message',
        'Failed to reopen 2 story issue(s)',
      );
      expect(failure).toHaveProperty('errors', [
        reopenFailureOfX,
        reopenFailureOfZ,
      ]);
      expect(storyIssueOf(storyObjectMap, 'feature / X')).toBeNull();
      expect(storyIssueOf(storyObjectMap, 'feature / Y')?.isClosed).toBe(false);
      expect(storyIssueOf(storyObjectMap, 'feature / Z')).toBeNull();
    });
  });
});
