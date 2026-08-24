import {
  findNextNonEmptyTabToRight,
  resolveDefaultActiveTab,
} from './tabAdvance';
import { type ConsoleTabName } from './types';

const counts = (
  overrides: Partial<Record<ConsoleTabName, number>>,
): Record<ConsoleTabName, number> => ({
  'workflow-blocker': 0,
  prs: 0,
  triage: 0,
  'failed-preparation': 0,
  'todo-by-human': 0,
  'todo-by-agent': 0,
  stories: 0,
  ...overrides,
});

describe('findNextNonEmptyTabToRight', () => {
  it('returns the first non-empty tab to the right of the active tab', () => {
    expect(findNextNonEmptyTabToRight('prs', counts({ triage: 7 }))).toBe(
      'triage',
    );
  });

  it('skips empty tabs and returns the next non-empty tab further right', () => {
    expect(
      findNextNonEmptyTabToRight(
        'prs',
        counts({ triage: 0, 'todo-by-human': 4 }),
      ),
    ).toBe('todo-by-human');
  });

  it('advances from todo-by-human to todo-by-agent when it has items', () => {
    expect(
      findNextNonEmptyTabToRight(
        'todo-by-human',
        counts({ 'todo-by-agent': 2 }),
      ),
    ).toBe('todo-by-agent');
  });

  it('returns the immediately adjacent tab when it is non-empty', () => {
    expect(
      findNextNonEmptyTabToRight('prs', counts({ triage: 12 })),
    ).toBe('triage');
  });

  it('returns null when no tab to the right has any items', () => {
    expect(
      findNextNonEmptyTabToRight('todo-by-human', counts({ prs: 35 })),
    ).toBeNull();
  });

  it('returns null when the active tab is the last tab', () => {
    expect(
      findNextNonEmptyTabToRight('todo-by-agent', counts({ prs: 35 })),
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
