import { renderHook, waitFor } from '@testing-library/react';
import { consoleListItemsFixture, consoleStatusTabFixture } from '../fixtures';
import { markItemProcessed } from '../overlay';
import { useConsoleTabCounts } from './useConsoleTabCounts';

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('useConsoleTabCounts', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=test-token');
  });

  it('counts other tabs after subtracting processed items', async () => {
    const fetchSpy = jest
      .spyOn(window, 'fetch')
      .mockResolvedValue(jsonResponse(consoleStatusTabFixture));
    const overlay = markItemProcessed({}, consoleListItemsFixture[0]);
    const { result } = renderHook(() => useConsoleTabCounts(overlay, 'prs', 3));
    await waitFor(() =>
      expect(result.current.counts.triage).toBeGreaterThan(0),
    );
    expect(result.current.counts.triage).toBe(
      consoleStatusTabFixture.items.length - 1,
    );
    expect(result.current.counts.prs).toBe(3);
    fetchSpy.mockRestore();
  });

  it('keeps the active tab count authoritative from the supplied value', async () => {
    const fetchSpy = jest
      .spyOn(window, 'fetch')
      .mockResolvedValue(jsonResponse(consoleStatusTabFixture));
    const { result } = renderHook(() => useConsoleTabCounts({}, 'unread', 9));
    await waitFor(() => expect(result.current.counts.unread).toBe(9));
    fetchSpy.mockRestore();
  });

  it('treats a failed tab fetch as a zero count', async () => {
    const fetchSpy = jest
      .spyOn(window, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 500 }));
    const { result } = renderHook(() => useConsoleTabCounts({}, 'prs', 0));
    await waitFor(() =>
      expect(result.current.counts['failed-preparation']).toBe(0),
    );
    fetchSpy.mockRestore();
  });
});
