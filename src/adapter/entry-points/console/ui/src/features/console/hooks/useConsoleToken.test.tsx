import { act, renderHook } from '@testing-library/react';
import { useConsoleToken } from './useConsoleToken';

const STORAGE_KEY = 'tdpm-console-token';

describe('useConsoleToken', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('reads the token from the query string and persists it', () => {
    window.history.replaceState({}, '', '/?k=query-token');
    const { result } = renderHook(() => useConsoleToken());
    expect(result.current.token).toBe('query-token');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('query-token');
  });

  it('falls back to the persisted token when the query has none', () => {
    localStorage.setItem(STORAGE_KEY, 'stored-token');
    const { result } = renderHook(() => useConsoleToken());
    expect(result.current.token).toBe('stored-token');
  });

  it('appends the token as a query parameter to a data url', () => {
    localStorage.setItem(STORAGE_KEY, 'stored-token');
    const { result } = renderHook(() => useConsoleToken());
    let appended = '';
    act(() => {
      appended = result.current.appendToken('./prs/list.json');
    });
    expect(appended).toBe('./prs/list.json?k=stored-token');
  });

  it('uses an ampersand when the url already has a query', () => {
    localStorage.setItem(STORAGE_KEY, 'stored-token');
    const { result } = renderHook(() => useConsoleToken());
    let appended = '';
    act(() => {
      appended = result.current.appendToken('/api/itembody?number=1');
    });
    expect(appended).toBe('/api/itembody?number=1&k=stored-token');
  });

  it('returns the url unchanged when no token is available', () => {
    const { result } = renderHook(() => useConsoleToken());
    expect(result.current.appendToken('./prs/list.json')).toBe(
      './prs/list.json',
    );
  });
});
