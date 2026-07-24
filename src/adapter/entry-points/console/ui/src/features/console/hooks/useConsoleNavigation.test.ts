import { act, renderHook } from '@testing-library/react';
import type { ConsoleTabName } from '../logic/types';
import {
  parseItemKeyFromHash,
  parseTabFromPath,
  useConsoleNavigation,
} from './useConsoleNavigation';

const counts = (
  overrides: Partial<Record<ConsoleTabName, number>> = {},
): Record<ConsoleTabName, number> => ({
  'workflow-blocker': 0,
  prs: 0,
  triage: 0,
  unread: 0,
  'failed-preparation': 0,
  'todo-by-human': 0,
  'todo-by-agent': 0,
  ...overrides,
});

describe('parseTabFromPath', () => {
  it('reads a known tab from the project path', () => {
    expect(parseTabFromPath('/projects/umino/triage')).toBe('triage');
  });

  it('returns null for an unknown tab segment', () => {
    expect(parseTabFromPath('/projects/umino/unknown')).toBeNull();
  });

  it('returns null when there is no tab segment', () => {
    expect(parseTabFromPath('/projects/umino')).toBeNull();
  });
});

describe('parseItemKeyFromHash', () => {
  it('decodes the item key from the hash', () => {
    expect(parseItemKeyFromHash('#item/PVTI_lADO%20123')).toBe('PVTI_lADO 123');
  });

  it('returns null when the hash is not an item hash', () => {
    expect(parseItemKeyFromHash('#other')).toBeNull();
  });
});

describe('useConsoleNavigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/projects/umino/prs?k=token');
  });

  it('reads the active tab from the path and no selected item', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation('umino', counts()),
    );
    expect(result.current.activeTab).toBe('prs');
    expect(result.current.selectedItemKey).toBeNull();
  });

  it('builds a project tab href', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation('umino', counts()),
    );
    expect(result.current.tabHref('triage')).toBe('/projects/umino/triage');
  });

  it('selects a tab and updates the path', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation('umino', counts()),
    );
    act(() => {
      result.current.selectTab('unread');
    });
    expect(result.current.activeTab).toBe('unread');
    expect(window.location.pathname).toBe('/projects/umino/unread');
  });

  it('opens an item and reflects it in the hash', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation('umino', counts()),
    );
    act(() => {
      result.current.openItem('PVTI_open');
    });
    expect(result.current.selectedItemKey).toBe('PVTI_open');
    expect(window.location.hash).toBe('#item/PVTI_open');
  });

  it('closes an item and clears the hash', () => {
    window.history.replaceState({}, '', '/projects/umino/prs#item/PVTI_open');
    const { result } = renderHook(() =>
      useConsoleNavigation('umino', counts()),
    );
    expect(result.current.selectedItemKey).toBe('PVTI_open');
    act(() => {
      result.current.closeItem();
    });
    expect(result.current.selectedItemKey).toBeNull();
    expect(window.location.hash).toBe('');
  });
});

describe('useConsoleNavigation default tab without a tab segment', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/projects/umino?k=token');
  });

  it('lands on the left-most tab when all tabs are non-empty', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation(
        'umino',
        counts({
          'workflow-blocker': 3,
          prs: 5,
          triage: 2,
          unread: 9,
          'failed-preparation': 1,
          'todo-by-human': 4,
        }),
      ),
    );
    expect(result.current.activeTab).toBe('workflow-blocker');
  });

  it('skips the empty left-most tab and lands on the next non-empty tab', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation(
        'umino',
        counts({ 'workflow-blocker': 0, prs: 0, triage: 8 }),
      ),
    );
    expect(result.current.activeTab).toBe('triage');
  });

  it('falls back to the first tab when every tab is empty', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation('umino', counts()),
    );
    expect(result.current.activeTab).toBe('workflow-blocker');
  });

  it('updates the default tab when counts arrive after the initial render', () => {
    const { result, rerender } = renderHook(
      ({ tabCounts }: { tabCounts: Record<ConsoleTabName, number> }) =>
        useConsoleNavigation('umino', tabCounts),
      { initialProps: { tabCounts: counts() } },
    );
    expect(result.current.activeTab).toBe('workflow-blocker');
    rerender({ tabCounts: counts({ unread: 6 }) });
    expect(result.current.activeTab).toBe('unread');
  });

  it('keeps the tab from the path even when counts are present', () => {
    window.history.replaceState({}, '', '/projects/umino/triage?k=token');
    const { result } = renderHook(() =>
      useConsoleNavigation('umino', counts({ unread: 6 })),
    );
    expect(result.current.activeTab).toBe('triage');
  });
});
