import { act, renderHook } from '@testing-library/react';
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
    throw new Error(STALE_STATUS_MESSAGE);
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

  it('hands a confirmed offline comment back to its item draft when the server answers with a non-2xx status, and keeps the queued entry', async () => {
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

    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
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
      text: async () => STALE_STATUS_MESSAGE,
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
