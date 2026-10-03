import { act, renderHook, waitFor } from '@testing-library/react';
import { useConsoleProjectList } from './useConsoleProjectList';
import { CONSOLE_TAB_REFRESH_INTERVAL_MS } from './useConsoleTabData';

describe('useConsoleProjectList', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts in loading state with empty pjcodes and no error', () => {
    global.fetch = jest.fn(
      () => new Promise(() => undefined),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.pjcodes).toEqual([]);
    expect(result.current.fleetTaskCreateUrl).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('populates pjcodes and clears loading state when fetchProjectList resolves', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ pjcodes: ['acme', 'beta'] }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.pjcodes).toEqual(['acme', 'beta']);
    expect(result.current.fleetTaskCreateUrl).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('populates fleetTaskCreateUrl when the server returns it', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcodes: ['acme'],
        fleetTaskCreateUrl: 'https://github.com/myorg/myrepo/issues/new',
      }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.pjcodes).toEqual(['acme']);
    expect(result.current.fleetTaskCreateUrl).toBe(
      'https://github.com/myorg/myrepo/issues/new',
    );
    expect(result.current.error).toBeNull();
  });

  it('sets error and clears loading state when fetchProjectList rejects', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('HTTP 401');
    expect(result.current.pjcodes).toEqual([]);
  });

  it('populates projectUrls when the server returns a project URL map', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcodes: ['acme'],
        projectUrls: { acme: 'https://github.com/users/owner/projects/1' },
      }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.projectUrls).toEqual({
      acme: 'https://github.com/users/owner/projects/1',
    });
    expect(result.current.error).toBeNull();
  });

  it('populates nameWithOwnerByPjcode when the server returns a nameWithOwner map', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcodes: ['acme'],
        nameWithOwnerByPjcode: {
          acme: 'HiromiShikata/umino-corporait-operation',
        },
      }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.nameWithOwnerByPjcode).toEqual({
      acme: 'HiromiShikata/umino-corporait-operation',
    });
    expect(result.current.error).toBeNull();
  });

  it('starts with an empty disabledPjcodes array', () => {
    global.fetch = jest.fn(
      () => new Promise(() => undefined),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    expect(result.current.disabledPjcodes).toEqual([]);
  });

  it('populates disabledPjcodes when the server returns disabled project codes', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcodes: ['acme', 'beta', 'sandbox'],
        disabledPjcodes: ['sandbox'],
      }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.disabledPjcodes).toEqual(['sandbox']);
    expect(result.current.error).toBeNull();
  });

  it('defaults disabledPjcodes to an empty array when the server omits it (completion criterion 5)', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ pjcodes: ['acme', 'beta'] }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleProjectList(false, false));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.disabledPjcodes).toEqual([]);
  });

  it('skips state update when component unmounts before fetch resolves', async () => {
    let resolveResponse!: (value: unknown) => void;
    const pendingFetch = new Promise<unknown>((resolve) => {
      resolveResponse = resolve;
    });
    global.fetch = jest.fn(() => pendingFetch) as unknown as typeof fetch;

    const { result, unmount } = renderHook(() =>
      useConsoleProjectList(false, false),
    );
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

  describe('background re-fetch', () => {
    const jsonResponseOf = (body: Record<string, unknown>) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('issues a second /api/projects call after 60 seconds while enabled and not foreground-loading', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponseOf({ pjcodes: ['acme'] }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useConsoleProjectList(true, false));
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([
      {
        name: 'enabled is false',
        enabled: false,
        isForegroundLoading: false,
      },
      {
        name: 'isForegroundLoading is true',
        enabled: true,
        isForegroundLoading: true,
      },
    ])(
      'does not issue a second /api/projects call after 60 seconds when $name',
      async ({ enabled, isForegroundLoading }) => {
        const fetchMock = jest
          .fn()
          .mockResolvedValue(jsonResponseOf({ pjcodes: ['acme'] }));
        global.fetch = fetchMock as unknown as typeof fetch;

        const { result } = renderHook(() =>
          useConsoleProjectList(enabled, isForegroundLoading),
        );
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await act(async () => {
          jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
    );

    it('leaves held state untouched when a background re-fetch returns identical values', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          jsonResponseOf({
            pjcodes: ['acme'],
            projectUrls: { acme: 'https://github.com/users/owner/projects/1' },
            fleetTaskCreateUrl: 'https://github.com/myorg/myrepo/issues/new',
            nameWithOwnerByPjcode: { acme: 'HiromiShikata/acme' },
            disabledPjcodes: [],
          }),
        );
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useConsoleProjectList(true, false));
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      const stateBefore = {
        pjcodes: result.current.pjcodes,
        projectUrls: result.current.projectUrls,
        fleetTaskCreateUrl: result.current.fleetTaskCreateUrl,
        nameWithOwnerByPjcode: result.current.nameWithOwnerByPjcode,
        disabledPjcodes: result.current.disabledPjcodes,
      };

      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.pjcodes).toBe(stateBefore.pjcodes);
      expect(result.current.projectUrls).toBe(stateBefore.projectUrls);
      expect(result.current.fleetTaskCreateUrl).toBe(
        stateBefore.fleetTaskCreateUrl,
      );
      expect(result.current.nameWithOwnerByPjcode).toBe(
        stateBefore.nameWithOwnerByPjcode,
      );
      expect(result.current.disabledPjcodes).toBe(stateBefore.disabledPjcodes);
    });

    it.each([
      {
        name: 'pjcodes',
        first: { pjcodes: ['acme'] },
        second: { pjcodes: ['acme', 'beta'] },
        assert: (value: {
          pjcodes: string[];
          projectUrls: Record<string, string> | null;
          fleetTaskCreateUrl: string | null;
          nameWithOwnerByPjcode: Record<string, string> | null;
          disabledPjcodes: string[];
        }) => expect(value.pjcodes).toEqual(['acme', 'beta']),
      },
      {
        name: 'projectUrls',
        first: { pjcodes: ['acme'], projectUrls: { acme: 'https://a' } },
        second: { pjcodes: ['acme'], projectUrls: { acme: 'https://b' } },
        assert: (value: {
          pjcodes: string[];
          projectUrls: Record<string, string> | null;
          fleetTaskCreateUrl: string | null;
          nameWithOwnerByPjcode: Record<string, string> | null;
          disabledPjcodes: string[];
        }) => expect(value.projectUrls).toEqual({ acme: 'https://b' }),
      },
      {
        name: 'fleetTaskCreateUrl',
        first: {
          pjcodes: ['acme'],
          fleetTaskCreateUrl: 'https://github.com/org/repo/issues/new',
        },
        second: {
          pjcodes: ['acme'],
          fleetTaskCreateUrl: 'https://github.com/org/repo2/issues/new',
        },
        assert: (value: {
          pjcodes: string[];
          projectUrls: Record<string, string> | null;
          fleetTaskCreateUrl: string | null;
          nameWithOwnerByPjcode: Record<string, string> | null;
          disabledPjcodes: string[];
        }) =>
          expect(value.fleetTaskCreateUrl).toBe(
            'https://github.com/org/repo2/issues/new',
          ),
      },
      {
        name: 'nameWithOwnerByPjcode',
        first: {
          pjcodes: ['acme'],
          nameWithOwnerByPjcode: { acme: 'HiromiShikata/acme' },
        },
        second: {
          pjcodes: ['acme'],
          nameWithOwnerByPjcode: { acme: 'HiromiShikata/acme-renamed' },
        },
        assert: (value: {
          pjcodes: string[];
          projectUrls: Record<string, string> | null;
          fleetTaskCreateUrl: string | null;
          nameWithOwnerByPjcode: Record<string, string> | null;
          disabledPjcodes: string[];
        }) =>
          expect(value.nameWithOwnerByPjcode).toEqual({
            acme: 'HiromiShikata/acme-renamed',
          }),
      },
      {
        name: 'disabledPjcodes',
        first: {
          pjcodes: ['acme', 'sandbox'],
          disabledPjcodes: [],
        },
        second: {
          pjcodes: ['acme', 'sandbox'],
          disabledPjcodes: ['sandbox'],
        },
        assert: (value: {
          pjcodes: string[];
          projectUrls: Record<string, string> | null;
          fleetTaskCreateUrl: string | null;
          nameWithOwnerByPjcode: Record<string, string> | null;
          disabledPjcodes: string[];
        }) => expect(value.disabledPjcodes).toEqual(['sandbox']),
      },
    ])(
      'replaces held state when a background re-fetch changes $name',
      async ({ first, second, assert }) => {
        const fetchMock = jest
          .fn()
          .mockResolvedValueOnce(jsonResponseOf(first))
          .mockResolvedValue(jsonResponseOf(second));
        global.fetch = fetchMock as unknown as typeof fetch;

        const { result } = renderHook(() =>
          useConsoleProjectList(true, false),
        );
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
          jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        assert(result.current);
      },
    );

    it('stops issuing background re-fetches after unmount', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponseOf({ pjcodes: ['acme'] }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result, unmount } = renderHook(() =>
        useConsoleProjectList(true, false),
      );
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      unmount();

      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS * 3);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
