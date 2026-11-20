import { act, renderHook } from '@testing-library/react';
import { ConsoleOperationRejectedError } from '../lib/consoleApi';
import { CONSOLE_ACTION_DELIVERY_STORAGE_KEY } from './consoleActionDelivery';
import {
  ConsoleActionPartiallySentError,
  useConsoleActionQueue,
} from './useConsoleActionQueue';

const OFFLINE_QUEUE_STORAGE_KEY = 'console-offline-action-queue';
const ITEM_KEY = 'PVTI_2';
const COMMENT_BODY = 'Checked during the flight.';
const ITEM_URL = 'https://github.com/o/r/issues/866';
const STALE_STATUS_MESSAGE =
  'Status changed since this action was queued: expected "Todo" but the issue\'s Status is now "Done". Please re-check the issue and act again.';

const itemFields = {
  itemUrl: ITEM_URL,
  projectItemId: ITEM_KEY,
  itemNumber: 866,
  repo: 'o/r',
  nameWithOwner: 'o/r',
  isPr: false,
};

const triagePayloadWithComment = {
  ...itemFields,
  composerDraftBody: COMMENT_BODY,
  apiPath: '/api/triage',
  requestBody: {
    pjcode: 'acme',
    action: 'set_status',
    issueUrl: ITEM_URL,
    projectItemId: ITEM_KEY,
    expectedStatusName: 'Todo',
    statusName: 'Awaiting Workspace',
    commentBody: COMMENT_BODY,
  },
};

const makeMoveAction = (
  overrides: Record<string, unknown> = {},
): Parameters<ReturnType<typeof useConsoleActionQueue>['enqueue']>[0] => ({
  message: 'Move to Awaiting Workspace',
  color: 'green',
  commit: jest.fn(async () => undefined),
  commitWithActionId: jest.fn(async () => {
    throw new ConsoleOperationRejectedError(STALE_STATUS_MESSAGE, false);
  }),
  advance: jest.fn(),
  offline: [triagePayloadWithComment],
  composerDraft: { projectItemId: ITEM_KEY, body: COMMENT_BODY },
  ...overrides,
});

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useConsoleActionQueue comment draft restore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it('hands an undelivered comment back to its item draft when the server rejects it', async () => {
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );
    const action = makeMoveAction();
    act(() => {
      result.current.enqueue(action);
    });

    act(() => {
      jest.advanceTimersByTime(5200);
    });
    await flush();

    expect(restoreCommentDraft).toHaveBeenCalledTimes(1);
    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
    expect(result.current.error).toHaveLength(1);
    expect(result.current.error[0]?.reason).toContain(
      'Status changed since this action was queued',
    );
    expect(
      JSON.parse(localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) ?? '[]'),
    ).toHaveLength(0);
  });

  it('does not hand back a comment that an earlier step already posted', async () => {
    const restoreCommentDraft = jest.fn();
    const commentStep = {
      ...itemFields,
      apiPath: '/api/comment',
      requestBody: {
        pjcode: 'acme',
        url: ITEM_URL,
        body: COMMENT_BODY,
      },
    };
    const statusStep = {
      ...itemFields,
      apiPath: '/api/triage',
      requestBody: {
        pjcode: 'acme',
        action: 'set_status',
        issueUrl: ITEM_URL,
        projectItemId: ITEM_KEY,
        statusName: 'Awaiting Workspace',
      },
    };
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );
    act(() => {
      result.current.enqueue(
        makeMoveAction({
          commit: jest.fn(async () => {
            throw new ConsoleActionPartiallySentError(
              1,
              new Error('status step failed'),
            );
          }),
          commitWithActionId: undefined,
          offline: [commentStep, statusStep],
        }),
      );
    });

    act(() => {
      jest.advanceTimersByTime(5200);
    });
    await flush();

    expect(restoreCommentDraft).not.toHaveBeenCalled();
  });

  it('never hands back a template comment the console built itself', async () => {
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );
    const templatePayload = {
      ...triagePayloadWithComment,
      composerDraftBody: undefined,
      requestBody: {
        ...triagePayloadWithComment.requestBody,
        commentBody: 'Template text the owner never wrote.',
      },
    };
    act(() => {
      result.current.enqueue(
        makeMoveAction({
          commitWithActionId: jest.fn(async () => {
            throw new Error(STALE_STATUS_MESSAGE);
          }),
          offline: [templatePayload],
          composerDraft: undefined,
        }),
      );
    });

    act(() => {
      jest.advanceTimersByTime(5200);
    });
    await flush();

    expect(restoreCommentDraft).not.toHaveBeenCalled();
    expect(result.current.error).toHaveLength(1);
  });

  it('keeps a confirmed offline comment queued with its Retry when the server does not say it was not posted', async () => {
    localStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify([
        {
          ...itemFields,
          composerDraftBody: COMMENT_BODY,
          apiPath: '/api/comment',
          requestBody: {
            pjcode: 'acme',
            url: ITEM_URL,
            body: COMMENT_BODY,
          },
          id: 'comment-422-1',
          message: 'Add comment',
          color: 'green',
          enqueuedAt: Date.now(),
        },
      ]),
    );
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 422,
      text: async () => 'comment rejected',
    })) as unknown as typeof fetch;
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );

    await act(async () => {
      await result.current.confirmOfflineAction('comment-422-1');
    });

    expect(restoreCommentDraft).not.toHaveBeenCalled();
    expect(result.current.offlineActions).toHaveLength(1);
    expect(result.current.error[0]?.retry).toEqual(expect.any(Function));
  });

  it('hands the comment back on a rejection even when the action has no offline payload', async () => {
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: null,
        restoreCommentDraft,
      }),
    );
    act(() => {
      result.current.enqueue(
        makeMoveAction({
          offline: undefined,
          composerDraft: { projectItemId: ITEM_KEY, body: COMMENT_BODY },
        }),
      );
    });

    act(() => {
      jest.advanceTimersByTime(5200);
    });
    await flush();

    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
    expect(result.current.error).toHaveLength(1);
  });

  it.each([
    ['not posted', false, 1],
    ['posted before the status change was refused', true, 0],
  ])(
    'hands a persisted comment back on replay when the comment was %s',
    async (_name, commentPosted, expectedRestores) => {
      const rejection = {
        error: STALE_STATUS_MESSAGE,
        commentPosted,
      };
      localStorage.setItem(
        CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
        JSON.stringify([
          {
            ...triagePayloadWithComment,
            id: `replay-${String(commentPosted)}`,
            message: 'Move to Awaiting Workspace',
            color: 'green',
            enqueuedAt: Date.now(),
          },
        ]),
      );
      global.fetch = jest.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(rejection),
        json: async () => rejection,
      })) as unknown as typeof fetch;
      const restoreCommentDraft = jest.fn();
      renderHook(() =>
        useConsoleActionQueue({
          isAirplaneModeOn: false,
          projectCode: 'acme',
          restoreCommentDraft,
        }),
      );

      await flush();
      await flush();

      expect(restoreCommentDraft).toHaveBeenCalledTimes(expectedRestores);
    },
  );

  it('discards a persisted comment that the server definitively rejects on replay, after handing it back', async () => {
    const rejection = { error: STALE_STATUS_MESSAGE, commentPosted: false };
    localStorage.setItem(
      CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
      JSON.stringify([
        {
          ...triagePayloadWithComment,
          id: 'replay-discard-1',
          message: 'Move to Awaiting Workspace',
          color: 'green',
          enqueuedAt: Date.now(),
        },
      ]),
    );
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify(rejection),
      json: async () => rejection,
    })) as unknown as typeof fetch;
    const restoreCommentDraft = jest.fn();
    renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );

    await flush();
    await flush();

    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
    expect(
      JSON.parse(
        localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY) ?? '[]',
      ),
    ).toHaveLength(0);
  });

  it('keeps a persisted comment and hands nothing back when the replay fails on the network', async () => {
    localStorage.setItem(
      CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
      JSON.stringify([
        {
          ...triagePayloadWithComment,
          id: 'replay-network-1',
          message: 'Move to Awaiting Workspace',
          color: 'green',
          enqueuedAt: Date.now(),
        },
      ]),
    );
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const restoreCommentDraft = jest.fn();
    renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );

    await flush();
    await flush();

    expect(restoreCommentDraft).not.toHaveBeenCalled();
    expect(
      JSON.parse(
        localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY) ?? '[]',
      ),
    ).toHaveLength(1);
  });

  it('hands a persisted plain comment back when the server definitively rejects it on replay', async () => {
    const rejection = { error: 'comment rejected', commentPosted: false };
    localStorage.setItem(
      CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
      JSON.stringify([
        {
          ...itemFields,
          composerDraftBody: COMMENT_BODY,
          apiPath: '/api/comment',
          requestBody: { pjcode: 'acme', url: ITEM_URL, body: COMMENT_BODY },
          id: 'replay-plain-1',
          message: 'Add comment',
          color: 'green',
          enqueuedAt: Date.now(),
        },
      ]),
    );
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 422,
      text: async () => JSON.stringify(rejection),
      json: async () => rejection,
    })) as unknown as typeof fetch;
    const restoreCommentDraft = jest.fn();
    renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );

    await flush();
    await flush();

    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
  });

  it('hands the comment back to the composer and offers no Retry when the server did not post it', async () => {
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );
    act(() => {
      result.current.enqueue(
        makeMoveAction({
          commitWithActionId: jest.fn(async () => {
            throw new ConsoleOperationRejectedError('upstream failure', false);
          }),
        }),
      );
    });

    act(() => {
      jest.advanceTimersByTime(5200);
    });
    await flush();

    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
    expect(result.current.error).toHaveLength(1);
    expect(result.current.error[0]?.retry).toBeUndefined();
  });

  it.each([
    ['the server refused it', 'comment rejected', 422],
    ['the server failed', 'upstream failure', 500],
  ])(
    'a persisted comment that %s on replay is handed back to the composer and dropped',
    async (_name, reason, status) => {
      const rejection = { error: reason, commentPosted: false };
      localStorage.setItem(
        CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
        JSON.stringify([
          {
            ...itemFields,
            composerDraftBody: COMMENT_BODY,
            apiPath: '/api/comment',
            requestBody: { pjcode: 'acme', url: ITEM_URL, body: COMMENT_BODY },
            id: `replay-status-${status}`,
            message: 'Add comment',
            color: 'green',
            enqueuedAt: Date.now(),
          },
        ]),
      );
      global.fetch = jest.fn(async () => ({
        ok: false,
        status,
        text: async () => JSON.stringify(rejection),
        json: async () => rejection,
      })) as unknown as typeof fetch;
      const restoreCommentDraft = jest.fn();
      const { result } = renderHook(() =>
        useConsoleActionQueue({
          isAirplaneModeOn: false,
          projectCode: 'acme',
          restoreCommentDraft,
        }),
      );

      await flush();
      await flush();

      expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
      expect(
        JSON.parse(
          localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY) ?? '[]',
        ),
      ).toHaveLength(0);
      expect(result.current.error[0]?.retry).toBeUndefined();
    },
  );

  it('clears the persisted entry when a Retry of an ambiguous failure succeeds', async () => {
    const commitWithActionId = jest
      .fn<Promise<void>, [number, string]>()
      .mockRejectedValueOnce(
        new ConsoleOperationRejectedError('upstream failure', null),
      )
      .mockResolvedValueOnce(undefined);
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );
    act(() => {
      result.current.enqueue(
        makeMoveAction({
          commitWithActionId,
          offline: [{ ...triagePayloadWithComment, id: 'ambiguous-retry-1' }],
        }),
      );
    });
    act(() => {
      jest.advanceTimersByTime(5200);
    });
    await flush();
    expect(result.current.error[0]?.retry).toEqual(expect.any(Function));
    expect(
      JSON.parse(
        localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY) ?? '[]',
      ),
    ).toHaveLength(1);

    await act(async () => {
      result.current.error[0]?.retry?.();
    });
    await flush();

    expect(commitWithActionId).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(
        localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY) ?? '[]',
      ),
    ).toHaveLength(0);
    expect(
      JSON.parse(localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) ?? '[]'),
    ).toHaveLength(0);
    expect(restoreCommentDraft).not.toHaveBeenCalled();
  });

  it('sends a persisted comment again when its Retry is pressed after an unknown failure', async () => {
    localStorage.setItem(
      CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
      JSON.stringify([
        {
          ...itemFields,
          composerDraftBody: COMMENT_BODY,
          apiPath: '/api/comment',
          requestBody: { pjcode: 'acme', url: ITEM_URL, body: COMMENT_BODY },
          id: 'replay-retry-1',
          message: 'Add comment',
          color: 'green',
          enqueuedAt: Date.now(),
        },
      ]),
    );
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => '{"error":"upstream failure"}',
        json: async () => ({ error: 'upstream failure' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"posted":true}',
        json: async () => ({ posted: true, comment: {} }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.error[0]?.retry?.();
    });
    await flush();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(restoreCommentDraft).not.toHaveBeenCalled();
    expect(
      JSON.parse(
        localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY) ?? '[]',
      ),
    ).toHaveLength(0);
  });

  it('keeps the persisted action with its Retry when the comment was posted and a later step failed', async () => {
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );
    act(() => {
      result.current.enqueue(
        makeMoveAction({
          commitWithActionId: jest.fn(async () => {
            throw new ConsoleActionPartiallySentError(
              1,
              new Error('status step failed'),
            );
          }),
          offline: [{ ...triagePayloadWithComment, id: 'partial-keep-1' }],
        }),
      );
    });

    act(() => {
      jest.advanceTimersByTime(5200);
    });
    await flush();

    expect(restoreCommentDraft).not.toHaveBeenCalled();
    expect(result.current.error[0]?.retry).toEqual(expect.any(Function));
    expect(
      JSON.parse(
        localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY) ?? '[]',
      ),
    ).toHaveLength(1);
  });

  it('hands a persisted comment back on replay when the server answers HTTP 200 with commentPosted false', async () => {
    const responseBody = {
      ok: false,
      commentPosted: false,
      error: 'comment failed',
    };
    localStorage.setItem(
      CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
      JSON.stringify([
        {
          ...triagePayloadWithComment,
          id: 'replay-200-refused-1',
          message: 'Move to Awaiting Workspace',
          color: 'green',
          enqueuedAt: Date.now(),
        },
      ]),
    );
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(responseBody),
      json: async () => responseBody,
    })) as unknown as typeof fetch;
    const restoreCommentDraft = jest.fn();
    renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );

    await flush();
    await flush();

    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
  });

  it('keeps a persisted comment with its replay when the server does not say whether it was posted', async () => {
    const rejection = { error: 'upstream failure' };
    localStorage.setItem(
      CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
      JSON.stringify([
        {
          ...itemFields,
          composerDraftBody: COMMENT_BODY,
          apiPath: '/api/comment',
          requestBody: { pjcode: 'acme', url: ITEM_URL, body: COMMENT_BODY },
          id: 'replay-ambiguous-1',
          message: 'Add comment',
          color: 'green',
          enqueuedAt: Date.now(),
        },
      ]),
    );
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify(rejection),
      json: async () => rejection,
    })) as unknown as typeof fetch;
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );

    await flush();
    await flush();

    expect(restoreCommentDraft).not.toHaveBeenCalled();
    expect(
      JSON.parse(
        localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY) ?? '[]',
      ),
    ).toHaveLength(1);
    expect(result.current.error[0]?.retry).toEqual(expect.any(Function));
  });

  it('hands back the comment of an offline action the server rejects when the owner confirms it', async () => {
    localStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify([
        {
          ...triagePayloadWithComment,
          id: 'action-stale-1',
          message: 'Move to Awaiting Workspace',
          color: 'green',
          enqueuedAt: Date.now(),
        },
      ]),
    );
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ error: STALE_STATUS_MESSAGE, commentPosted: false }),
    })) as unknown as typeof fetch;
    const restoreCommentDraft = jest.fn();
    const { result } = renderHook(() =>
      useConsoleActionQueue({
        isAirplaneModeOn: false,
        projectCode: 'acme',
        restoreCommentDraft,
      }),
    );

    await act(async () => {
      await result.current.confirmOfflineAction('action-stale-1');
    });

    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
    expect(result.current.offlineActions).toHaveLength(0);
  });
});
