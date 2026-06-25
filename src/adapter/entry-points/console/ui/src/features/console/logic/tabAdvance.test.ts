import {
  findNextNonEmptyTabToRight,
  resolveDefaultActiveTab,
} from './tabAdvance';
import type { ConsoleTabName } from './types';

const counts = (
  overrides: Partial<Record<ConsoleTabName, number>>,
): Record<ConsoleTabName, number> => ({
  'workflow-blocker': 0,
  prs: 0,
  triage: 0,
  unread: 0,
  'failed-preparation': 0,
  'todo-by-human': 0,
  ...overrides,
});

describe('findNextNonEmptyTabToRight', () => {
  it('returns the first non-empty tab to the right of the active tab', () => {
    expect(findNextNonEmptyTabToRight('prs', counts({ unread: 7 }))).toBe(
      'unread',
    );
  });

  it('skips empty tabs and returns the next non-empty tab further right', () => {
    expect(
      findNextNonEmptyTabToRight(
        'prs',
        counts({ triage: 0, unread: 0, 'todo-by-human': 4 }),
      ),
    ).toBe('todo-by-human');
  });

  it('returns the immediately adjacent tab when it is non-empty', () => {
    expect(
      findNextNonEmptyTabToRight('prs', counts({ triage: 12, unread: 7 })),
    ).toBe('triage');
  });

  it('returns null when no tab to the right has any items', () => {
    expect(
      findNextNonEmptyTabToRight('unread', counts({ prs: 35 })),
    ).toBeNull();
  });

  it('returns null when the active tab is the last tab', () => {
    expect(
      findNextNonEmptyTabToRight('todo-by-human', counts({ prs: 35 })),
    ).toBeNull();
  });
});

describe('resolveDefaultActiveTab', () => {
  it('returns the left-most tab when every tab is non-empty', () => {
    expect(
      resolveDefaultActiveTab(
        counts({
          'workflow-blocker': 3,
          prs: 5,
          triage: 2,
          unread: 9,
          'failed-preparation': 1,
          'todo-by-human': 4,
        }),
      ),
    ).toBe('workflow-blocker');
  });

  it('skips empty left-most tabs and returns the first non-empty tab', () => {
    expect(
      resolveDefaultActiveTab(
        counts({ 'workflow-blocker': 0, prs: 0, triage: 8 }),
      ),
    ).toBe('triage');
  });

  it('falls back to the first tab when every tab is empty', () => {
    expect(resolveDefaultActiveTab(counts({}))).toBe('workflow-blocker');
  });
});
