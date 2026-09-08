import { act, renderHook } from '@testing-library/react';
import { useConsoleTabSelectHandler } from './useConsoleTabSelectHandler';

const STORAGE_KEY_PREFIX = 'console-comment-expanded:';

describe('useConsoleTabSelectHandler', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears all comment expanded states before calling selectTab', () => {
    const url1 = 'https://github.com/owner/repo/issues/10';
    const url2 = 'https://github.com/owner/repo/issues/20';
    localStorage.setItem(STORAGE_KEY_PREFIX + url1, JSON.stringify(['key-a']));
    localStorage.setItem(STORAGE_KEY_PREFIX + url2, JSON.stringify(['key-b']));

    const mockSelectTab = jest.fn();
    const { result } = renderHook(() =>
      useConsoleTabSelectHandler(mockSelectTab),
    );

    act(() => {
      result.current('prs');
    });

    expect(localStorage.getItem(STORAGE_KEY_PREFIX + url1)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_PREFIX + url2)).toBeNull();
    expect(mockSelectTab).toHaveBeenCalledWith('prs');
  });

  it('calls selectTab with the given tab name', () => {
    const mockSelectTab = jest.fn();
    const { result } = renderHook(() =>
      useConsoleTabSelectHandler(mockSelectTab),
    );

    act(() => {
      result.current('todo-by-human');
    });

    expect(mockSelectTab).toHaveBeenCalledWith('todo-by-human');
  });

  it('does not remove unrelated localStorage entries when clearing', () => {
    localStorage.setItem('console-story-show-gray', 'true');

    const mockSelectTab = jest.fn();
    const { result } = renderHook(() =>
      useConsoleTabSelectHandler(mockSelectTab),
    );

    act(() => {
      result.current('prs');
    });

    expect(localStorage.getItem('console-story-show-gray')).toBe('true');
  });

  it('calls selectTab even when there are no expanded states to clear', () => {
    const mockSelectTab = jest.fn();
    const { result } = renderHook(() =>
      useConsoleTabSelectHandler(mockSelectTab),
    );

    act(() => {
      result.current('stories');
    });

    expect(mockSelectTab).toHaveBeenCalledWith('stories');
  });
});
