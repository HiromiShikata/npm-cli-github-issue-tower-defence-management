import { renderHook } from '@testing-library/react';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../fixtures';
import type { ConsoleApiClient } from './consoleApiClient';
import { eventAdvances, useConsoleOperation } from './useConsoleOperation';

const createClient = (): ConsoleApiClient => ({
  fetchItemBody: jest.fn(),
  fetchComments: jest.fn(),
  fetchPullRequestFiles: jest.fn(),
  fetchPullRequestCommits: jest.fn(),
  fetchRelatedPullRequests: jest.fn(),
  fetchPullRequestDetail: jest.fn(),
  postReview: jest.fn(async () => undefined),
  postTriage: jest.fn(async () => undefined),
  postInTmux: jest.fn(async () => undefined),
});

describe('eventAdvances', () => {
  it('keeps snooze events in place on non-todo tabs', () => {
    expect(eventAdvances('prs', 'snooze_1day')).toBe(false);
    expect(eventAdvances('unread', 'snooze_1week')).toBe(false);
  });

  it('advances snooze events on the todo-by-human tab', () => {
    expect(eventAdvances('todo-by-human', 'snooze_1day')).toBe(true);
    expect(eventAdvances('todo-by-human', 'snooze_1week')).toBe(true);
  });
});

describe('useConsoleOperation', () => {
  it('posts a review for a PR item and advances', async () => {
    const client = createClient();
    const onProcessed = jest.fn();
    const onAdvance = jest.fn();
    const { result } = renderHook(() =>
      useConsoleOperation({
        client,
        tab: 'prs',
        item: consoleListItemsFixture[0],
        reviewTarget: { repo: 'owner/repo', number: 9 },
        onProcessed,
        onAdvance,
      }),
    );
    await result.current.onReview('APPROVE');
    expect(client.postReview).toHaveBeenCalledWith(
      { repo: 'owner/repo', number: 9 },
      'APPROVE',
    );
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('does not advance after a snooze on a non-todo tab', async () => {
    const client = createClient();
    const onAdvance = jest.fn();
    const { result } = renderHook(() =>
      useConsoleOperation({
        client,
        tab: 'prs',
        item: consoleListItemsFixture[2],
        reviewTarget: null,
        onProcessed: jest.fn(),
        onAdvance,
      }),
    );
    await result.current.onSnooze('snooze_1day');
    expect(client.postTriage).toHaveBeenCalled();
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('advances after a snooze on the todo-by-human tab', async () => {
    const client = createClient();
    const onAdvance = jest.fn();
    const { result } = renderHook(() =>
      useConsoleOperation({
        client,
        tab: 'todo-by-human',
        item: consoleListItemsFixture[2],
        reviewTarget: null,
        onProcessed: jest.fn(),
        onAdvance,
      }),
    );
    await result.current.onSnooze('snooze_1week');
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('routes set-status through the triage endpoint with the option id', async () => {
    const client = createClient();
    const { result } = renderHook(() =>
      useConsoleOperation({
        client,
        tab: 'unread',
        item: consoleListItemsFixture[2],
        reviewTarget: null,
        onProcessed: jest.fn(),
        onAdvance: jest.fn(),
      }),
    );
    await result.current.onSetStatus(consoleStatusOptionsFixture[3]);
    expect(client.postTriage).toHaveBeenCalledWith(
      consoleListItemsFixture[2].projectItemId,
      consoleListItemsFixture[2].repo,
      consoleListItemsFixture[2].number,
      'set_status',
      consoleStatusOptionsFixture[3].id,
    );
  });

  it('routes in-tmux through the dedicated endpoint', async () => {
    const client = createClient();
    const { result } = renderHook(() =>
      useConsoleOperation({
        client,
        tab: 'failed-preparation',
        item: consoleListItemsFixture[2],
        reviewTarget: null,
        onProcessed: jest.fn(),
        onAdvance: jest.fn(),
      }),
    );
    await result.current.onSetInTmux(consoleStatusOptionsFixture[1]);
    expect(client.postInTmux).toHaveBeenCalledTimes(1);
  });

  it('throws when reviewing an item with no review target', async () => {
    const client = createClient();
    const { result } = renderHook(() =>
      useConsoleOperation({
        client,
        tab: 'unread',
        item: consoleListItemsFixture[2],
        reviewTarget: null,
        onProcessed: jest.fn(),
        onAdvance: jest.fn(),
      }),
    );
    await expect(result.current.onReview('APPROVE')).rejects.toThrow(
      'No linked open pull request',
    );
  });
});
