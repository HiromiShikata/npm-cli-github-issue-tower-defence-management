import { act, renderHook } from '@testing-library/react';
import { useConsoleProjectSelectHandler } from './useConsoleProjectSelectHandler';

const STORAGE_KEY_PREFIX = 'console-comment-expanded:';

describe('useConsoleProjectSelectHandler', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears all comment expanded states before calling selectProject', () => {
    const url1 = 'https://github.com/owner/repo/issues/10';
    const url2 = 'https://github.com/owner/repo/issues/20';
    localStorage.setItem(STORAGE_KEY_PREFIX + url1, JSON.stringify(['key-a']));
    localStorage.setItem(STORAGE_KEY_PREFIX + url2, JSON.stringify(['key-b']));

    const mockSelectProject = jest.fn();
    const { result } = renderHook(() =>
      useConsoleProjectSelectHandler(mockSelectProject),
    );

    act(() => {
      result.current('acme');
    });

    expect(localStorage.getItem(STORAGE_KEY_PREFIX + url1)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_PREFIX + url2)).toBeNull();
    expect(mockSelectProject).toHaveBeenCalledWith('acme');
  });

  it('calls selectProject with the given pjcode', () => {
    const mockSelectProject = jest.fn();
    const { result } = renderHook(() =>
      useConsoleProjectSelectHandler(mockSelectProject),
    );

    act(() => {
      result.current('beta');
    });

    expect(mockSelectProject).toHaveBeenCalledWith('beta');
  });

  it('does not remove unrelated localStorage entries when clearing', () => {
    localStorage.setItem('console-story-show-gray', 'true');

    const mockSelectProject = jest.fn();
    const { result } = renderHook(() =>
      useConsoleProjectSelectHandler(mockSelectProject),
    );

    act(() => {
      result.current('acme');
    });

    expect(localStorage.getItem('console-story-show-gray')).toBe('true');
  });

  it('calls selectProject even when there are no expanded states to clear', () => {
    const mockSelectProject = jest.fn();
    const { result } = renderHook(() =>
      useConsoleProjectSelectHandler(mockSelectProject),
    );

    act(() => {
      result.current('gamma');
    });

    expect(mockSelectProject).toHaveBeenCalledWith('gamma');
  });
});
