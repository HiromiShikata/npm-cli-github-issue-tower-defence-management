import type { Issue } from '../entities/Issue';
import { handOverIssuesMoveToStoryFront } from './handOverIssuesMoveToStoryFront';

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: null,
  story: null,
  storyOptionId: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  author: 'user',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

describe('handOverIssuesMoveToStoryFront', () => {
  const testCases: {
    name: string;
    storiedIssues: Issue[];
    handOverIssueUrls: ReadonlySet<string>;
    expectedIssueUrlsInOrder: string[];
  }[] = [
    {
      name: 'moves the hand-over issue to the front of its own story without changing cross-story order',
      storiedIssues: [
        createIssue({
          url: 'https://github.com/user/repo/issues/1',
          storyOptionId: 'story-a',
        }),
        createIssue({
          url: 'https://github.com/user/repo/issues/2',
          storyOptionId: 'story-b',
        }),
        createIssue({
          url: 'https://github.com/user/repo/issues/3',
          storyOptionId: 'story-a',
        }),
      ],
      handOverIssueUrls: new Set(['https://github.com/user/repo/issues/3']),
      expectedIssueUrlsInOrder: [
        'https://github.com/user/repo/issues/3',
        'https://github.com/user/repo/issues/1',
        'https://github.com/user/repo/issues/2',
      ],
    },
    {
      name: 'keeps the existing order untouched when no issue is a hand-over',
      storiedIssues: [
        createIssue({
          url: 'https://github.com/user/repo/issues/1',
          storyOptionId: 'story-a',
        }),
        createIssue({
          url: 'https://github.com/user/repo/issues/2',
          storyOptionId: 'story-a',
        }),
      ],
      handOverIssueUrls: new Set(),
      expectedIssueUrlsInOrder: [
        'https://github.com/user/repo/issues/1',
        'https://github.com/user/repo/issues/2',
      ],
    },
    {
      name: 'preserves relative order among multiple hand-over issues in the same story',
      storiedIssues: [
        createIssue({
          url: 'https://github.com/user/repo/issues/1',
          storyOptionId: 'story-a',
        }),
        createIssue({
          url: 'https://github.com/user/repo/issues/2',
          storyOptionId: 'story-a',
        }),
        createIssue({
          url: 'https://github.com/user/repo/issues/3',
          storyOptionId: 'story-a',
        }),
      ],
      handOverIssueUrls: new Set([
        'https://github.com/user/repo/issues/2',
        'https://github.com/user/repo/issues/3',
      ]),
      expectedIssueUrlsInOrder: [
        'https://github.com/user/repo/issues/2',
        'https://github.com/user/repo/issues/3',
        'https://github.com/user/repo/issues/1',
      ],
    },
    {
      name: 'groups issues by story option id even when interleaved across stories in the input order',
      storiedIssues: [
        createIssue({
          url: 'https://github.com/user/repo/issues/1',
          storyOptionId: 'story-a',
        }),
        createIssue({
          url: 'https://github.com/user/repo/issues/2',
          storyOptionId: 'story-b',
        }),
        createIssue({
          url: 'https://github.com/user/repo/issues/3',
          storyOptionId: 'story-a',
        }),
        createIssue({
          url: 'https://github.com/user/repo/issues/4',
          storyOptionId: 'story-b',
        }),
      ],
      handOverIssueUrls: new Set(['https://github.com/user/repo/issues/4']),
      expectedIssueUrlsInOrder: [
        'https://github.com/user/repo/issues/1',
        'https://github.com/user/repo/issues/3',
        'https://github.com/user/repo/issues/4',
        'https://github.com/user/repo/issues/2',
      ],
    },
  ];

  test.each(testCases)('$name', (testCase) => {
    const result = handOverIssuesMoveToStoryFront(
      testCase.storiedIssues,
      testCase.handOverIssueUrls,
    );
    expect(result.map((issue) => issue.url)).toEqual(
      testCase.expectedIssueUrlsInOrder,
    );
  });
});
