import { act, renderHook } from '@testing-library/react';
import type { ConsoleTabName } from '../logic/types';
import {
  parseItemKeyFromHash,
  parseSettingsFromHash,
  parseTabFromPath,
  useConsoleNavigation,
} from './useConsoleNavigation';

const counts = (
  overrides: Partial<Record<ConsoleTabName, number>> = {},
): Record<ConsoleTabName, number> => ({
  'workflow-blocker': 0,
  prs: 0,
  'failed-preparation': 0,
  'todo-by-human': 0,
  'todo-by-agent': 0,
  queued: 0,
  stories: 0,
  ...overrides,
});

describe('parseTabFromPath', () => {
  it('reads a known tab from the project path', () => {
    expect(parseTabFromPath('/projects/acme/prs')).toBe('prs');
  });

  it('returns null for an unknown tab segment', () => {
    expect(parseTabFromPath('/projects/acme/unknown')).toBeNull();
  });

  it('returns null for the removed triage segment', () => {
    expect(parseTabFromPath('/projects/acme/triage')).toBeNull();
  });

  it('returns null when there is no tab segment', () => {
    expect(parseTabFromPath('/projects/acme')).toBeNull();
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

describe('parseSettingsFromHash', () => {
  it('returns true for the settings hash', () => {
    expect(parseSettingsFromHash('#settings')).toBe(true);
  });

  it('returns false for an item hash', () => {
    expect(parseSettingsFromHash('#item/PVTI_123')).toBe(false);
  });

  it('returns false for an empty hash', () => {
    expect(parseSettingsFromHash('')).toBe(false);
  });

  it('returns false for an unrelated hash', () => {
    expect(parseSettingsFromHash('#other')).toBe(false);
  });
});

describe('useConsoleNavigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  });

  it('reads the active tab from the path and no selected item', () => {
    const { result } = renderHook(() => useConsoleNavigation('acme', counts()));
    expect(result.current.activeTab).toBe('prs');
    expect(result.current.selectedItemKey).toBeNull();
  });

  it('builds a project tab href', () => {
    const { result } = renderHook(() => useConsoleNavigation('acme', counts()));
    expect(result.current.tabHref('todo-by-human')).toBe(
      '/projects/acme/todo-by-human',
    );
  });

  it('selects a tab and updates the path', () => {
    const { result } = renderHook(() => useConsoleNavigation('acme', counts()));
    act(() => {
      result.current.selectTab('todo-by-human');
    });
    expect(result.current.activeTab).toBe('todo-by-human');
    expect(window.location.pathname).toBe('/projects/acme/todo-by-human');
  });

  it('opens an item and reflects it in the hash', () => {
    const { result } = renderHook(() => useConsoleNavigation('acme', counts()));
    act(() => {
      result.current.openItem('PVTI_open');
    });
    expect(result.current.selectedItemKey).toBe('PVTI_open');
    expect(window.location.hash).toBe('#item/PVTI_open');
  });

  it('closes an item and clears the hash', () => {
    window.history.replaceState({}, '', '/projects/acme/prs#item/PVTI_open');
    const { result } = renderHook(() => useConsoleNavigation('acme', counts()));
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
    window.history.replaceState({}, '', '/projects/acme?k=token');
  });

  it('lands on the left-most tab when all tabs are non-empty', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation(
        'acme',
        counts({
          'workflow-blocker': 3,
          prs: 5,
          'failed-preparation': 1,
          'todo-by-human': 4,
        }),
      ),
    );
    expect(result.current.activeTab).toBe('prs');
  });

  it('skips the empty left-most tab and lands on the next non-empty tab', () => {
    const { result } = renderHook(() =>
      useConsoleNavigation(
        'acme',
        counts({ 'workflow-blocker': 0, prs: 0, 'failed-preparation': 8 }),
      ),
    );
    expect(result.current.activeTab).toBe('failed-preparation');
  });

  it('falls back to the first tab when every tab is empty', () => {
    const { result } = renderHook(() => useConsoleNavigation('acme', counts()));
    expect(result.current.activeTab).toBe('prs');
  });

  it('updates the default tab when counts arrive after the initial render', () => {
    const { result, rerender } = renderHook(
      ({ tabCounts }: { tabCounts: Record<ConsoleTabName, number> }) =>
        useConsoleNavigation('acme', tabCounts),
      { initialProps: { tabCounts: counts() } },
    );
    expect(result.current.activeTab).toBe('prs');
    rerender({ tabCounts: counts({ 'failed-preparation': 6 }) });
    expect(result.current.activeTab).toBe('failed-preparation');
  });

  it('keeps the tab from the path even when counts are present', () => {
    window.history.replaceState({}, '', '/projects/acme/todo-by-human?k=token');
    const { result } = renderHook(() =>
      useConsoleNavigation('acme', counts({ 'todo-by-human': 6 })),
    );
    expect(result.current.activeTab).toBe('todo-by-human');
  });
});
