import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  COMMENT_OPERATION_PATH,
  type ConsoleCommentRequest,
  postConsoleComment,
  postConsoleOperation,
} from '../lib/consoleApi';
import {
  ACTION_TOAST_DELAY_MS,
  type ConsoleToastColor,
} from '../logic/actionToast';
import { clearAllCommentExpandedStates } from '../logic/commentExpandedStorage';
import { overlayCloseSuccessRecord } from './useConsoleOverlay';
import {
  deliverPersistedConsoleAction,
  loadPersistedConsoleActions,
  persistConsoleAction,
  removePersistedConsoleAction,
} from './consoleActionDelivery';

export type ConsoleOfflinePayload = {
  itemUrl: string;
  projectItemId: string;
  itemNumber: number;
  repo: string;
  nameWithOwner: string;
  isPr: boolean;
  apiPath: string;
  requestBody: Record<string, unknown>;
  id?: string;
};

export type ConsoleOfflineQueuedAction = {
  id: string;
  actionId?: string;
  message: string;
  color: ConsoleToastColor;
  enqueuedAt: number;
} & ConsoleOfflinePayload;

export type ConsoleQueuedAction = {
  message: string;
  color: ConsoleToastColor;
  commit: (sentStepCount: number) => Promise<void>;
  commitWithActionId?: (
    sentStepCount: number,
    actionId: string,
  ) => Promise<void>;
  advance: () => void;
  revertAdvance?: () => void;
  optimistic?: () => void;
  revertOptimistic?: () => void;
  offline?: ConsoleOfflinePayload[];
};

export type ConsoleOfflineActionsCreateRequest = {
  payloads: ConsoleOfflinePayload[];
  message: string;
  color: ConsoleToastColor;
};

export type ConsoleActionQueueOptions = {
  isAirplaneModeOn: boolean;
};

export type ConsolePendingActionView = {
  id: string;
  createdAt: number;
  message: string;
  color: ConsoleToastColor;
};

export type ConsoleActionError = {
  id: string;
  createdAt: number;
  message: string;
  reason: string;
  retry?: () => void;
};

export type ConsoleActionWriteStatus =
  'idle' | 'unconfirmed' | 'succeeded' | 'failed' | 'offline';

export type ConsoleActionWriteState = {
  status: ConsoleActionWriteStatus;
  attempt: number;
};

const OFFLINE_QUEUE_STORAGE_KEY = 'console-offline-action-queue';

const isConsoleOfflineQueuedAction = (
  item: unknown,
): item is ConsoleOfflineQueuedAction => {
  if (typeof item !== 'object' || item === null) return false;
  const a = item as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    typeof a.message === 'string' &&
    typeof a.color === 'string' &&
    typeof a.enqueuedAt === 'number' &&
    typeof a.itemUrl === 'string' &&
    typeof a.projectItemId === 'string' &&
    typeof a.itemNumber === 'number' &&
    typeof a.repo === 'string' &&
    typeof a.nameWithOwner === 'string' &&
    typeof a.isPr === 'boolean' &&
    typeof a.apiPath === 'string' &&
    typeof a.requestBody === 'object' &&
    a.requestBody !== null
  );
};

const isConsoleCommentRequest = (
  requestBody: Record<string, unknown>,
): requestBody is ConsoleCommentRequest =>
  typeof requestBody.pjcode === 'string' &&
  typeof requestBody.url === 'string' &&
  typeof requestBody.body === 'string';

const loadOfflineQueue = (): ConsoleOfflineQueuedAction[] => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deliveryIds = new Set(
      loadPersistedConsoleActions().map((action) => action.id),
    );
    return parsed.filter(
      (item) =>
        isConsoleOfflineQueuedAction(item) &&
        !deliveryIds.has((item as ConsoleOfflineQueuedAction).id),
    );
  } catch {
    return [];
  }
};

const saveOfflineQueue = (actions: ConsoleOfflineQueuedAction[]): void => {
  localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(actions));
};

const generateId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const isNetworkError = (error: unknown): boolean =>
  error instanceof TypeError;

export class ConsoleActionPartiallySentError extends Error {
  readonly sentStepCount: number;
  declare readonly cause: unknown;

  constructor(sentStepCount: number, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'ConsoleActionPartiallySentError';
    this.sentStepCount = sentStepCount;
    this.cause = cause;
  }
}

export const consoleActionStepsRun = async (
  steps: ReadonlyArray<() => Promise<void>>,
  sentStepCount = 0,
): Promise<void> => {
  for (
    let stepIndex = sentStepCount;
    stepIndex < steps.length;
    stepIndex += 1
  ) {
    try {
      await steps[stepIndex]();
    } catch (cause: unknown) {
      if (stepIndex === 0) {
        throw cause;
      }
      throw new ConsoleActionPartiallySentError(stepIndex, cause);
    }
  }
};

const AIRPLANE_MODE_ERROR_MESSAGE = 'Airplane mode';
const AIRPLANE_MODE_ERROR_REASON =
  'This action requires a network connection. Turn off airplane mode and try again.';

const errorReason = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
};

const COUNTDOWN_TICK_MS = 100;

export type ConsoleActionQueue = {
  pending: ConsolePendingActionView[];
  error: ConsoleActionError[];
  offlineActions: ConsoleOfflineQueuedAction[];
  writeState: ConsoleActionWriteState;
  enqueueSequence: number;
  enqueue: (action: ConsoleQueuedAction) => void;
  offlineActionsCreate: (request: ConsoleOfflineActionsCreateRequest) => void;
  showError: (message: string, reason: string) => void;
  undo: (id: string) => void;
  dismiss: (id: string) => void;
  dismissError: (id: string) => void;
  confirmOfflineAction: (id: string) => Promise<void>;
  discardOfflineAction: (id: string) => void;
};

type ConsolePendingEntryState = {
  id: string;
  createdAt: number;
  action: ConsoleQueuedAction;
  startedAt: number;
  timer: ReturnType<typeof setInterval> | null;
};

export const useConsoleActionQueue = (
  options: ConsoleActionQueueOptions = { isAirplaneModeOn: false },
): ConsoleActionQueue => {
  const isAirplaneModeOnRef = useRef<boolean>(options.isAirplaneModeOn);
  isAirplaneModeOnRef.current = options.isAirplaneModeOn;
  const deliveredActionIdsRef = useRef<Set<string>>(new Set());
  const [pending, setPending] = useState<ConsolePendingActionView[]>([]);
  const [error, setError] = useState<ConsoleActionError[]>([]);
  const [offlineActions, setOfflineActions] =
    useState<ConsoleOfflineQueuedAction[]>(loadOfflineQueue);
  const offlineActionsRef =
    useRef<ConsoleOfflineQueuedAction[]>(offlineActions);
  offlineActionsRef.current = offlineActions;

  const pendingEntriesRef = useRef<Map<string, ConsolePendingEntryState>>(
    new Map(),
  );
  const runCommitRef = useRef<
    (
      action: ConsoleQueuedAction,
      sentStepCount: number,
      retryOfErrorId?: string,
    ) => void
  >(() => {});
  const attemptRef = useRef(0);
  const [writeState, setWriteState] = useState<ConsoleActionWriteState>({
    status: 'idle',
    attempt: 0,
  });
  const [enqueueSequence, setEnqueueSequence] = useState(0);

  const appendError = useCallback(
    (newError: {
      message: string;
      reason: string;
      retry?: () => void;
    }): void => {
      setError((prev) => [
        ...prev,
        { id: generateId(), createdAt: Date.now(), ...newError },
      ]);
    },
    [],
  );

  const offlineActionsCreate = useCallback(
    ({
      payloads,
      message,
      color,
    }: ConsoleOfflineActionsCreateRequest): void => {
      const enqueuedAt = Date.now();
      const created: ConsoleOfflineQueuedAction[] = payloads.map((payload) => {
        const offlinePayload = { ...payload } as ConsoleOfflinePayload & {
          actionId?: string;
        };
        delete offlinePayload.actionId;
        return {
          id: generateId(),
          message,
          color,
          enqueuedAt,
          ...offlinePayload,
        };
      });
      setOfflineActions((prev) => {
        const next = [...prev, ...created];
        saveOfflineQueue(next);
        return next;
      });
    },
    [],
  );

  const runCommit = useCallback(
    (
      action: ConsoleQueuedAction,
      sentStepCount: number,
      retryOfErrorId?: string,
    ): void => {
      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      const errorId = retryOfErrorId ?? generateId();
      const applyError = (newError: {
        message: string;
        reason: string;
        retry?: () => void;
      }): void => {
        setError((prev) => {
          const existingIndex = prev.findIndex((e) => e.id === errorId);
          if (existingIndex === -1) {
            return [
              ...prev,
              { id: errorId, createdAt: Date.now(), ...newError },
            ];
          }
          return prev.map((e, index) =>
            index === existingIndex ? { ...e, ...newError } : e,
          );
        });
      };
      const offlinePayloads = action.offline ?? [];
      const actionHoldOffline = (
        unsentOfflinePayloads: ConsoleOfflinePayload[],
      ): void => {
        for (const payload of unsentOfflinePayloads) {
          if (payload.id !== undefined)
            removePersistedConsoleAction(payload.id);
        }
        offlineActionsCreate({
          payloads: unsentOfflinePayloads,
          message: action.message,
          color: action.color,
        });
        setWriteState({ status: 'offline', attempt });
      };
      if (isAirplaneModeOnRef.current) {
        const unsentOfflinePayloads = offlinePayloads.slice(sentStepCount);
        if (unsentOfflinePayloads.length > 0) {
          actionHoldOffline(unsentOfflinePayloads);
        } else {
          action.revertAdvance?.();
          action.revertOptimistic?.();
          applyError({
            message: AIRPLANE_MODE_ERROR_MESSAGE,
            reason: AIRPLANE_MODE_ERROR_REASON,
          });
          setWriteState({ status: 'failed', attempt });
        }
        return;
      }
      setWriteState({ status: 'unconfirmed', attempt });
      (action.commitWithActionId === undefined
        ? action.commit(sentStepCount)
        : action.commitWithActionId(
            sentStepCount,
            String(offlinePayloads[0]?.id ?? ''),
          )
      )
        .then(() => {
          for (const payload of offlinePayloads) {
            removePersistedConsoleAction(payload.id ?? '');
          }
          setWriteState({ status: 'succeeded', attempt });
        })
        .catch((cause: unknown) => {
          const isPartiallySent =
            cause instanceof ConsoleActionPartiallySentError;
          const sentStepCountAfterAttempt = isPartiallySent
            ? cause.sentStepCount
            : sentStepCount;
          const unsentOfflinePayloads = offlinePayloads.slice(
            sentStepCountAfterAttempt,
          );
          const unsentRequestFailure = isPartiallySent ? cause.cause : cause;
          if (
            isNetworkError(unsentRequestFailure) &&
            unsentOfflinePayloads.length > 0
          ) {
            actionHoldOffline(unsentOfflinePayloads);
          } else {
            for (const payload of offlinePayloads) {
              if (payload.id !== undefined)
                removePersistedConsoleAction(payload.id);
            }
            applyError({
              message: action.message,
              reason: errorReason(unsentRequestFailure),
              retry: () =>
                runCommitRef.current(
                  action,
                  sentStepCountAfterAttempt,
                  errorId,
                ),
            });
            setWriteState({ status: 'failed', attempt });
          }
        });
    },
    [offlineActionsCreate],
  );
  runCommitRef.current = runCommit;

  const commitEntry = useCallback(
    (id: string): void => {
      const entry = pendingEntriesRef.current.get(id);
      if (entry === undefined) return;
      if (entry.timer !== null) {
        clearInterval(entry.timer);
      }
      pendingEntriesRef.current.delete(id);
      setPending((prev) => prev.filter((p) => p.id !== id));
      clearAllCommentExpandedStates();
      runCommit(entry.action, 0);
    },
    [runCommit],
  );

  const undo = useCallback((id: string): void => {
    const entry = pendingEntriesRef.current.get(id);
    if (entry === undefined) return;
    if (entry.timer !== null) {
      clearInterval(entry.timer);
    }
    pendingEntriesRef.current.delete(id);
    setPending((prev) => prev.filter((p) => p.id !== id));
    for (const payload of entry.action.offline ?? []) {
      removePersistedConsoleAction(payload.id ?? '');
    }
    entry.action.revertAdvance?.();
    entry.action.revertOptimistic?.();
  }, []);

  const dismiss = useCallback(
    (id: string): void => {
      commitEntry(id);
    },
    [commitEntry],
  );

  const dismissError = useCallback((id: string): void => {
    setError((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const showError = useCallback(
    (message: string, reason: string): void => {
      appendError({ message, reason });
    },
    [appendError],
  );

  const discardOfflineAction = useCallback((id: string): void => {
    setOfflineActions((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveOfflineQueue(next);
      return next;
    });
  }, []);

  const confirmOfflineAction = useCallback(
    async (id: string): Promise<void> => {
      const action = offlineActionsRef.current.find((a) => a.id === id);
      if (action === undefined) return;
      try {
        if (
          action.apiPath === COMMENT_OPERATION_PATH &&
          isConsoleCommentRequest(action.requestBody)
        ) {
          const result = await postConsoleComment(action.requestBody);
          if (result.posted) {
            discardOfflineAction(id);
            return;
          }
          const resetInfo =
            result.rateLimitResetAt !== null
              ? ` Rate limit resets at ${result.rateLimitResetAt}.`
              : '';
          appendError({
            message: action.message,
            reason: `${result.error}.${resetInfo}`,
            retry: () => void confirmOfflineAction(id),
          });
          return;
        }
        const response = await postConsoleOperation(
          action.apiPath,
          action.requestBody,
        );
        overlayCloseSuccessRecord(action.requestBody, response);
        discardOfflineAction(id);
      } catch (cause: unknown) {
        if (isNetworkError(cause)) {
          appendError({
            message: action.message,
            reason: 'Still offline — action is still held in the queue',
          });
        } else {
          appendError({ message: action.message, reason: errorReason(cause) });
          discardOfflineAction(id);
        }
      }
    },
    [appendError, discardOfflineAction],
  );

  const enqueue = useCallback(
    (action: ConsoleQueuedAction): void => {
      setEnqueueSequence((previous) => previous + 1);
      const id = generateId();
      const createdAt = Date.now();
      const entry: ConsolePendingEntryState = {
        id,
        createdAt,
        action,
        startedAt: createdAt,
        timer: null,
      };
      const persisted = (action.offline ?? []).map((payload) => {
        const persistedId =
          typeof payload.requestBody.actionId === 'string'
            ? payload.requestBody.actionId
            : generateId();
        const descriptor: ConsoleOfflineQueuedAction = {
          id: persistedId,
          actionId: persistedId,
          message: action.message,
          color: action.color,
          enqueuedAt: createdAt,
          ...payload,
        };
        persistConsoleAction(descriptor);
        return descriptor;
      });
      const entryAction =
        persisted.length > 0 ? { ...action, offline: persisted } : action;
      const entryWithAction = { ...entry, action: entryAction };
      pendingEntriesRef.current.set(id, entryWithAction);
      setPending((prev) => [
        ...prev,
        {
          id,
          createdAt,
          message: action.message,
          color: action.color,
        },
      ]);
      action.advance();
      action.optimistic?.();
      entry.timer = setInterval(() => {
        const elapsed = Date.now() - entry.startedAt;
        if (elapsed >= ACTION_TOAST_DELAY_MS) {
          commitEntry(id);
        }
      }, COUNTDOWN_TICK_MS);
    },
    [commitEntry],
  );

  useLayoutEffect(() => {
    const replay = (): void => {
      const persistedActions = loadPersistedConsoleActions();
      for (const action of persistedActions) {
        if (deliveredActionIdsRef.current.has(action.id)) continue;
        deliveredActionIdsRef.current.add(action.id);
        void deliverPersistedConsoleAction(action).catch((cause: unknown) => {
          appendError({
            message: action.message,
            reason: errorReason(cause),
            retry: () => void replay(),
          });
        });
      }
    };
    const deliverPending = (): void => {
      const entries = Array.from(pendingEntriesRef.current.values());
      for (const entry of entries) {
        if (entry.timer !== null) {
          clearInterval(entry.timer);
        }
        pendingEntriesRef.current.delete(entry.id);
        setPending((prev) => prev.filter((pending) => pending.id !== entry.id));
        const offlinePayloads = entry.action.offline ?? [];
        if (offlinePayloads.length === 0) {
          void entry.action.commit(0).catch((cause: unknown) =>
            appendError({
              message: entry.action.message,
              reason: errorReason(cause),
            }),
          );
        }
        for (const payload of offlinePayloads) {
          const action = loadPersistedConsoleActions().find(
            (candidate) => candidate.id === payload.id,
          );
          if (action !== undefined) {
            if (deliveredActionIdsRef.current.has(action.id)) continue;
            deliveredActionIdsRef.current.add(action.id);
            void deliverPersistedConsoleAction(action, true).catch(
              (cause: unknown) =>
                appendError({
                  message: entry.action.message,
                  reason: errorReason(cause),
                }),
            );
          }
        }
      }
    };
    replay();
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') deliverPending();
    };
    window.addEventListener('pagehide', deliverPending);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', deliverPending);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      deliverPending();
    };
  }, [appendError]);

  return {
    pending,
    error,
    offlineActions,
    writeState,
    enqueueSequence,
    enqueue,
    offlineActionsCreate,
    showError,
    undo,
    dismiss,
    dismissError,
    confirmOfflineAction,
    discardOfflineAction,
  };
};
