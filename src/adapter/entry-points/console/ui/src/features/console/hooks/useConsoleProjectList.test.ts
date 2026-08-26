import { act, renderHook, waitFor } from '@testing-library/react';
import { useConsoleProjectList } from './useConsoleProjectList';

describe('useConsoleProjectList', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts in loading state with empty pjcodes and no error', () => {
    global.fetch = jest.fn(
      () => new Promise(() => undefined),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.pjcodes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('populates pjcodes and clears loading state when fetchProjectList resolves', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ pjcodes: ['acme', 'beta'] }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.pjcodes).toEqual(['acme', 'beta']);
    expect(result.current.error).toBeNull();
  });

  it('sets error and clears loading state when fetchProjectList rejects', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('HTTP 401');
    expect(result.current.pjcodes).toEqual([]);
  });

  it('skips state update when component unmounts before fetch resolves', async () => {
    let resolveResponse!: (value: unknown) => void;
    const pendingFetch = new Promise<unknown>((resolve) => {
      resolveResponse = resolve;
    });
    global.fetch = jest.fn(() => pendingFetch) as unknown as typeof fetch;

    const { result, unmount } = renderHook(() => useConsoleProjectList());
    expect(result.current.isLoading).toBe(true);

    unmount();

    await act(async () => {
      resolveResponse({
        ok: true,
        status: 200,
        json: async () => ({ pjcodes: ['acme'] }),
      });
    });

    expect(result.current.pjcodes).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
