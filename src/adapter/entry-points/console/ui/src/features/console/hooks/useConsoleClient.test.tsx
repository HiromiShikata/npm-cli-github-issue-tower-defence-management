import { renderHook } from '@testing-library/react';
import { useConsoleClient } from './useConsoleClient';

describe('useConsoleClient', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=test-token');
  });

  it('exposes an api client and an item cache', () => {
    const { result } = renderHook(() => useConsoleClient());
    expect(typeof result.current.client.fetchItemBody).toBe('function');
    expect(typeof result.current.cache.getItemBody).toBe('function');
  });

  it('returns a stable client across re-renders with the same token', () => {
    const { result, rerender } = renderHook(() => useConsoleClient());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
