import {
  parseDependedIssueUrlsInput,
  patchTaskInStories,
} from './consoleStoryTaskPatch';
import type { ConsoleListItem, ConsoleStoryEntry } from './types';

const makeItem = (
  projectItemId: string,
  overrides: Partial<ConsoleListItem> = {},
): ConsoleListItem => ({
  number: 1,
  title: `Task ${projectItemId}`,
  url: `https://github.com/demo/repo/issues/${projectItemId}`,
  repo: 'demo/repo',
  nameWithOwner: 'demo/repo',
  projectItemId,
  itemId: projectItemId,
  isPr: false,
  story: 'Story',
  status: 'Todo by human',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  relatedOpenPullRequestUrls: [],
  ...overrides,
});

const makeEntry = (
  storyOptionId: string,
  items: ConsoleListItem[],
): ConsoleStoryEntry => ({
  storyName: storyOptionId,
  storyOptionId,
  color: 'BLUE',
  description: '',
  openItemCount: items.length,
  storyViewUrl: null,
  items,
});

describe('patchTaskInStories', () => {
  it('updates only the task whose projectItemId matches', () => {
    const entries = [
      makeEntry('story-a', [makeItem('item-1'), makeItem('item-2')]),
    ];
    const patched = patchTaskInStories(entries, 'item-2', {
      status: 'Done',
    });
    expect(patched[0].items.map((item) => item.status)).toEqual([
      'Todo by human',
      'Done',
    ]);
  });

  it.each([
    {
      name: 'patches a task in another story',
      entries: [
        makeEntry('story-a', [makeItem('item-1')]),
        makeEntry('story-b', [makeItem('item-2')]),
      ],
      projectItemId: 'item-2',
      expectedChangedStoryId: 'story-b',
    },
    {
      name: 'leaves all stories unchanged when no task matches',
      entries: [makeEntry('story-a', [makeItem('item-1')])],
      projectItemId: 'missing',
      expectedChangedStoryId: null,
    },
  ])('$name', ({ entries, projectItemId, expectedChangedStoryId }) => {
    const patched = patchTaskInStories(entries, projectItemId, {
      agent: 'developer',
    });
    entries.forEach((entry, index) => {
      if (entry.storyOptionId === expectedChangedStoryId) {
        expect(patched[index]).not.toBe(entry);
        expect(patched[index].items[0].agent).toBe('developer');
      } else {
        expect(patched[index]).toBe(entry);
      }
    });
  });

  it('does not mutate the input entries', () => {
    const entries = [makeEntry('story-a', [makeItem('item-1')])];
    patchTaskInStories(entries, 'item-1', { nextActionHour: 9 });
    expect(entries[0].items[0].nextActionHour).toBeNull();
  });

  it('treats a story without items as having no matching task', () => {
    const entry: ConsoleStoryEntry = {
      ...makeEntry('story-a', []),
      items: undefined as unknown as ConsoleListItem[],
    };
    expect(patchTaskInStories([entry], 'item-1', { agent: 'x' })).toEqual([
      entry,
    ]);
  });
});

describe('parseDependedIssueUrlsInput', () => {
  it.each([
    { name: 'empty input yields no URLs', input: '', expected: [] },
    { name: 'whitespace only yields no URLs', input: '  ,  ', expected: [] },
    {
      name: 'single URL is trimmed',
      input: '  https://github.com/a/b/issues/1  ',
      expected: ['https://github.com/a/b/issues/1'],
    },
    {
      name: 'comma-separated URLs are split and trimmed',
      input: 'https://github.com/a/b/issues/1 , https://github.com/a/b/issues/2,',
      expected: [
        'https://github.com/a/b/issues/1',
        'https://github.com/a/b/issues/2',
      ],
    },
  ])('$name', ({ input, expected }) => {
    expect(parseDependedIssueUrlsInput(input)).toEqual(expected);
  });
});
