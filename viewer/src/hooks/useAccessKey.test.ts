import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccessKey } from './useAccessKey';

describe('useAccessKey', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', {
      search: '',
      pathname: '/projects/test/prs',
      href: 'http://localhost/projects/test/prs',
    });
    Object.defineProperty(window, 'history', {
      value: { replaceState: vi.fn() },
      writable: true,
    });
  });

  it('returns null when no key exists', () => {
    const { result } = renderHook(() => useAccessKey());
    expect(result.current.accessKey).toBeNull();
  });

  it('reads key from sessionStorage', () => {
    sessionStorage.setItem('accessKey', 'stored-key');
    const { result } = renderHook(() => useAccessKey());
    expect(result.current.accessKey).toBe('stored-key');
  });

  it('extracts key from URL and redirects', () => {
    vi.stubGlobal('location', {
      search: '?accessKey=url-key',
      pathname: '/projects/test/prs',
    });
    const { result } = renderHook(() => useAccessKey());
    expect(result.current.accessKey).toBe('url-key');
    expect(sessionStorage.getItem('accessKey')).toBe('url-key');
  });

  it('updates key via setAccessKey', () => {
    const { result } = renderHook(() => useAccessKey());
    act(() => {
      result.current.setAccessKey('new-key');
    });
    expect(result.current.accessKey).toBe('new-key');
    expect(sessionStorage.getItem('accessKey')).toBe('new-key');
  });
});
