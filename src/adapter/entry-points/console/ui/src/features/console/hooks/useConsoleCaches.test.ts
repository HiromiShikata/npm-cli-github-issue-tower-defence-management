import { renderHook } from '@testing-library/react';
import { useConsoleCaches } from './useConsoleCaches';

describe('useConsoleCaches', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=token');
  });

  it('exposes one cache per resource and a stable identity across renders', () => {
    const { result, rerender } = renderHook(() => useConsoleCaches());
    const first = result.current;
    expect(first.body).toBeDefined();
    expect(first.comments).toBeDefined();
    expect(first.files).toBeDefined();
    expect(first.commits).toBeDefined();
    expect(first.relatedPrs).toBeDefined();
    expect(first.state).toBeDefined();
    rerender();
    expect(result.current).toBe(first);
  });
});
