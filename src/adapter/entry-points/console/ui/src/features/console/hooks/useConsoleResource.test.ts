import { renderHook, waitFor } from '@testing-library/react';
import { ResourceCache } from '../lib/resourceCache';
import { useConsoleResource } from './useConsoleResource';

describe('useConsoleResource', () => {
  it('loads the resource and exposes loading then data', async () => {
    const cache = new ResourceCache<string>(async () => 'loaded');
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe('fallback');
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toBe('loaded');
    expect(result.current.error).toBeNull();
  });

  it('stays idle with the fallback when the key is null', () => {
    const cache = new ResourceCache<string>(async () => 'loaded');
    const { result } = renderHook(() =>
      useConsoleResource(cache, null, null, 'fallback'),
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe('fallback');
  });

  it('surfaces a fetch error', async () => {
    const cache = new ResourceCache<string>(async () => {
      throw new Error('boom');
    });
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await waitFor(() => {
      expect(result.current.error).toBe('boom');
    });
    expect(result.current.isLoading).toBe(false);
  });
});
