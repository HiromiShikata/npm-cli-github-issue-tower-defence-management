import { act, renderHook } from '@testing-library/react';
import {
  parseItemKeyFromHash,
  parseTabFromPath,
  useConsoleNavigation,
} from './useConsoleNavigation';

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
    const { result } = renderHook(() => useConsoleNavigation('umino'));
    expect(result.current.activeTab).toBe('prs');
    expect(result.current.selectedItemKey).toBeNull();
  });

  it('builds a project tab href', () => {
    const { result } = renderHook(() => useConsoleNavigation('umino'));
    expect(result.current.tabHref('triage')).toBe('/projects/umino/triage');
  });

  it('selects a tab and updates the path', () => {
    const { result } = renderHook(() => useConsoleNavigation('umino'));
    act(() => {
      result.current.selectTab('unread');
    });
    expect(result.current.activeTab).toBe('unread');
    expect(window.location.pathname).toBe('/projects/umino/unread');
  });

  it('opens an item and reflects it in the hash', () => {
    const { result } = renderHook(() => useConsoleNavigation('umino'));
    act(() => {
      result.current.openItem('PVTI_open');
    });
    expect(result.current.selectedItemKey).toBe('PVTI_open');
    expect(window.location.hash).toBe('#item/PVTI_open');
  });

  it('closes an item and clears the hash', () => {
    window.history.replaceState({}, '', '/projects/umino/prs#item/PVTI_open');
    const { result } = renderHook(() => useConsoleNavigation('umino'));
    expect(result.current.selectedItemKey).toBe('PVTI_open');
    act(() => {
      result.current.closeItem();
    });
    expect(result.current.selectedItemKey).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
