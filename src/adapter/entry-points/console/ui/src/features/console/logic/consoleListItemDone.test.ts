import { isConsoleListItemDone } from './consoleListItemDone';
import type { ConsoleListItem } from './types';

const item = (overrides: Record<string, unknown> = {}): ConsoleListItem =>
  ({
    number: 12345,
    title: 'Example task for done-state behavior',
    url: 'https://github.com/example/repository/issues/12345',
    repo: 'example/repository',
    nameWithOwner: 'example/repository',
    projectItemId: 'item-1',
    itemId: 'item-1',
    isPr: false,
    story: 'regular / NO STORY',
    status: 'In Tmux by human',
    agent: null,
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [],
    labels: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    relatedOpenPullRequestUrls: [],
    ...overrides,
  }) as ConsoleListItem;

describe('isConsoleListItemDone', () => {
  it.each([
    {
      label: 'closed task with a non-Done status',
      item: item({ isClosed: true }),
      expected: true,
    },
    {
      label: 'open task with Done status',
      item: item({ isClosed: false, status: 'Done' }),
      expected: true,
    },
    {
      label: 'open task with an active status',
      item: item({ isClosed: undefined, status: 'In Tmux' }),
      expected: false,
    },
    {
      label: 'open task with no status',
      item: item({ isClosed: false, status: null }),
      expected: false,
    },
  ])('returns $expected for a $label', ({ item: listItem, expected }) => {
    expect(isConsoleListItemDone(listItem)).toBe(expected);
  });
});
