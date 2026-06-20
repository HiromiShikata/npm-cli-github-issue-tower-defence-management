import { renderHook, waitFor } from '@testing-library/react';
import { useConsoleTabData } from './useConsoleTabData';

describe('useConsoleTabData', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=token');
  });

  it('fetches every tab once at startup and parses snapshots', async () => {
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcode: 'umino',
        generatedAt: '2026-06-19T00:00:00.000Z',
        statusOptions: [{ id: 's1', name: 'Unread', color: 'ORANGE' }],
        storyColors: {},
        items: url.includes('/prs/')
          ? [{ number: 1, itemId: 'PVTI_1', projectItemId: 'PVTI_1' }]
          : [],
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('umino'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/projects/umino/prs/list.json'),
    );
    expect(result.current.snapshots.prs?.items.length).toBe(1);
    expect(result.current.snapshots.prs?.generatedAt).toBe(
      '2026-06-19T00:00:00.000Z',
    );
  });

  it('surfaces an error when a tab fetch fails', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useConsoleTabData('umino'));
    await waitFor(() => {
      expect(result.current.error).toBe('HTTP 500');
    });
  });

  it('reports an error and fetches nothing when no pjcode is in the URL', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useConsoleTabData(null));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe('No project specified in the URL path.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
