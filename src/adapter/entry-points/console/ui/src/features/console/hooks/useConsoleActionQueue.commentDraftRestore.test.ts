import { act, renderHook } from '@testing-library/react';
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

  it('hands the comment back when the owner undoes the action inside the window', () => {
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
    const pendingId = result.current.pending[0]?.id ?? '';

    act(() => {
      result.current.undo(pendingId);
    });

    expect(restoreCommentDraft).toHaveBeenCalledWith(ITEM_KEY, COMMENT_BODY);
    expect(action.commitWithActionId).not.toHaveBeenCalled();
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
