import { act, renderHook } from '@testing-library/react';
import { AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY } from '../logic/awaitingOwnerListVisibilitySettings';
import { useConsoleAwaitingOwnerListVisibilitySettings } from './useConsoleAwaitingOwnerListVisibilitySettings';

describe('useConsoleAwaitingOwnerListVisibilitySettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initialises saved and draft to true when localStorage is empty and the setting was never saved', () => {
    const { result } = renderHook(() =>
      useConsoleAwaitingOwnerListVisibilitySettings(false),
    );
    expect(result.current.showExecutiveSummaryAndActionButton).toBe(true);
    expect(result.current.draftShowExecutiveSummaryAndActionButton).toBe(
      true,
    );
  });

  it('initialises saved and draft from a previously saved false value', () => {
    localStorage.setItem(
      AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
      JSON.stringify({ showExecutiveSummaryAndActionButton: false }),
    );
    const { result } = renderHook(() =>
      useConsoleAwaitingOwnerListVisibilitySettings(false),
    );
    expect(result.current.showExecutiveSummaryAndActionButton).toBe(false);
    expect(result.current.draftShowExecutiveSummaryAndActionButton).toBe(
      false,
    );
  });

  it('toggleDraft changes only the draft value, leaves saved unchanged, and does not write to localStorage', () => {
    const { result } = renderHook(() =>
      useConsoleAwaitingOwnerListVisibilitySettings(true),
    );
    act(() => {
      result.current.toggleDraft(false);
    });
    expect(result.current.draftShowExecutiveSummaryAndActionButton).toBe(
      false,
    );
    expect(result.current.showExecutiveSummaryAndActionButton).toBe(true);
    expect(
      localStorage.getItem(AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY),
    ).toBeNull();
  });

  it('save persists the current draft to localStorage and updates the saved value', () => {
    const { result } = renderHook(() =>
      useConsoleAwaitingOwnerListVisibilitySettings(true),
    );
    act(() => {
      result.current.toggleDraft(false);
    });
    act(() => {
      result.current.save();
    });
    expect(result.current.showExecutiveSummaryAndActionButton).toBe(false);
    const stored = localStorage.getItem(
      AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
    );
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual({
      showExecutiveSummaryAndActionButton: false,
    });
  });

  it('resets the draft back to the saved value when isMaxSettingsOpen flips from false to true without a save', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useConsoleAwaitingOwnerListVisibilitySettings(isOpen),
      { initialProps: { isOpen: false } },
    );
    act(() => {
      result.current.toggleDraft(false);
    });
    expect(result.current.draftShowExecutiveSummaryAndActionButton).toBe(
      false,
    );
    rerender({ isOpen: true });
    expect(result.current.draftShowExecutiveSummaryAndActionButton).toBe(
      true,
    );
    expect(result.current.showExecutiveSummaryAndActionButton).toBe(true);
  });

  it('keeps the draft equal to what was just saved, never some other earlier value, while isMaxSettingsOpen stays true through a save', () => {
    const { result } = renderHook(() =>
      useConsoleAwaitingOwnerListVisibilitySettings(true),
    );
    act(() => {
      result.current.toggleDraft(false);
    });
    act(() => {
      result.current.save();
    });
    expect(result.current.draftShowExecutiveSummaryAndActionButton).toBe(
      false,
    );
    expect(result.current.showExecutiveSummaryAndActionButton).toBe(false);
  });
});
