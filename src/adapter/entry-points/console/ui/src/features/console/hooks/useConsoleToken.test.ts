import { act, renderHook } from '@testing-library/react';
import { useConsoleToken } from './useConsoleToken';

describe('useConsoleToken', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('reads the token from the query string and appends it to data urls', () => {
    window.history.replaceState({}, '', '/?k=secret');
    const { result } = renderHook(() => useConsoleToken());
    expect(result.current.token).toBe('secret');
    expect(result.current.appendToken('./prs/list.json')).toBe(
      './prs/list.json?k=secret',
    );
    expect(result.current.appendToken('./api/itembody?url=x')).toBe(
      './api/itembody?url=x&k=secret',
    );
  });

  it('persists the token to localStorage', () => {
    window.history.replaceState({}, '', '/?k=persisted');
    renderHook(() => useConsoleToken());
    expect(localStorage.getItem('tdpm-console-token')).toBe('persisted');
  });

  it('reads a persisted token when no query token exists', () => {
    localStorage.setItem('tdpm-console-token', 'stored');
    const { result } = renderHook(() => useConsoleToken());
    expect(result.current.token).toBe('stored');
  });

  it('returns the url unchanged when there is no token', () => {
    const { result } = renderHook(() => useConsoleToken());
    act(() => {});
    expect(result.current.appendToken('./prs/list.json')).toBe(
      './prs/list.json',
    );
  });
});
