import { renderHook, waitFor } from '@testing-library/react';
import { ResourceCache } from '../lib/resourceCache';
import type { ConsoleComment, ConsoleListItem } from '../logic/types';
import { useConsolePrsTabSummaries } from './useConsolePrsTabSummaries';

const makeItem = (
  projectItemId: string,
  number: number,
  repo = 'owner/repo',
): ConsoleListItem => ({
  number,
  title: `Item ${number}`,
  url: `https://github.com/${repo}/issues/${number}`,
  repo,
  nameWithOwner: repo,
  projectItemId,
  itemId: projectItemId,
  isPr: false,
  story: '',
  status: 'Awaiting Quality Check',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-08-31T00:00:00.000Z',
  relatedOpenPullRequestUrls: [],
});

const AGENT_BODY = `## エグゼクティブサマリ / Executive Summary
タスクのゴール: 一覧のカードにボタンを追加する
残りの作業と判断: レビュー待ち
From: :robot: agent (model)`;

const makeComments = (body: string): ConsoleComment[] => [
  { author: 'bot', body, createdAt: '2026-08-31T01:00:00.000Z' },
];

describe('useConsolePrsTabSummaries', () => {
  it('returns an empty map and makes no requests when disabled', () => {
    const fetcher = jest.fn().mockResolvedValue([]);
    const cache = new ResourceCache<ConsoleComment[]>(fetcher);
    const items = [makeItem('id-1', 1)];

    const { result } = renderHook(() =>
      useConsolePrsTabSummaries(items, cache, false),
    );

    expect(result.current).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fetches comments and returns extracted summary for each item', async () => {
    const item1 = makeItem('id-1', 1);
    const item2 = makeItem('id-2', 2);
    const fetcher = jest.fn().mockResolvedValue(makeComments(AGENT_BODY));
    const cache = new ResourceCache<ConsoleComment[]>(fetcher);

    const { result } = renderHook(() =>
      useConsolePrsTabSummaries([item1, item2], cache, true),
    );

    await waitFor(() => {
      expect(Object.keys(result.current).length).toBe(2);
    });

    expect(result.current['id-1']).toContain('タスクのゴール:');
    expect(result.current['id-2']).toContain('タスクのゴール:');
  });

  it('sets null for an item whose last comment has no executive summary', async () => {
    const item = makeItem('id-1', 1);
    const fetcher = jest
      .fn()
      .mockResolvedValue(makeComments('No summary here.'));
    const cache = new ResourceCache<ConsoleComment[]>(fetcher);

    const { result } = renderHook(() =>
      useConsolePrsTabSummaries([item], cache, true),
    );

    await waitFor(() => {
      expect('id-1' in result.current).toBe(true);
    });

    expect(result.current['id-1']).toBeNull();
  });

  it('sets null when the fetch fails', async () => {
    const item = makeItem('id-1', 1);
    const fetcher = jest.fn().mockRejectedValue(new Error('network error'));
    const cache = new ResourceCache<ConsoleComment[]>(fetcher);

    const { result } = renderHook(() =>
      useConsolePrsTabSummaries([item], cache, true),
    );

    await waitFor(() => {
      expect('id-1' in result.current).toBe(true);
    });

    expect(result.current['id-1']).toBeNull();
  });

  it('uses cached comments without a new fetch', async () => {
    const item = makeItem('id-1', 1);
    const fetcher = jest.fn().mockResolvedValue([]);
    const cache = new ResourceCache<ConsoleComment[]>(fetcher);
    cache.seed(`${item.repo}#${item.number}`, makeComments(AGENT_BODY));

    const { result } = renderHook(() =>
      useConsolePrsTabSummaries([item], cache, true),
    );

    await waitFor(() => {
      expect('id-1' in result.current).toBe(true);
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current['id-1']).toContain('タスクのゴール:');
  });
});
