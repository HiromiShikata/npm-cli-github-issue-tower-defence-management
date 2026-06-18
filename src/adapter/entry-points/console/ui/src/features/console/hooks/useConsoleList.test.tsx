import { renderHook, waitFor } from '@testing-library/react';
import { consoleStatusTabFixture, consoleTriageTabFixture } from '../fixtures';
import { useConsoleList } from './useConsoleList';

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('useConsoleList', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=test-token');
  });

  it('loads items, status options, and story colors from the status tab payload', async () => {
    const fetchSpy = jest
      .spyOn(window, 'fetch')
      .mockResolvedValue(jsonResponse(consoleStatusTabFixture));
    const { result } = renderHook(() => useConsoleList('prs'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(
      consoleStatusTabFixture.items.length,
    );
    expect(result.current.statusOptions).toHaveLength(4);
    expect(result.current.storyColors['TDPM Console port']).toBe('BLUE');
    const requestedUrl = fetchSpy.mock.calls[0][0] as string;
    expect(requestedUrl).toContain('./prs/list.json');
    expect(requestedUrl).toContain('k=test-token');
    fetchSpy.mockRestore();
  });

  it('reads the triage story colors from the object-shaped payload', async () => {
    const fetchSpy = jest
      .spyOn(window, 'fetch')
      .mockResolvedValue(jsonResponse(consoleTriageTabFixture));
    const { result } = renderHook(() => useConsoleList('triage'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.storyOptions).toHaveLength(3);
    expect(result.current.storyColors['regular / workflow improvement']).toBe(
      'GREEN',
    );
    fetchSpy.mockRestore();
  });

  it('surfaces an error when the request fails', async () => {
    const fetchSpy = jest
      .spyOn(window, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 500 }));
    const { result } = renderHook(() => useConsoleList('unread'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('HTTP 500');
    fetchSpy.mockRestore();
  });
});
