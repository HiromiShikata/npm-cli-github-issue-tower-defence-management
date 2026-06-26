import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTION_TOAST_DELAY_MS,
  type ConsoleToastColor,
} from '../logic/actionToast';

export type ConsoleQueuedAction = {
  message: string;
  color: ConsoleToastColor;
  commit: () => Promise<void>;
  advance: () => void;
};

export type ConsolePendingActionView = {
  message: string;
  color: ConsoleToastColor;
  remainingSeconds: number;
  progress: number;
};

export type ConsoleActionError = {
  message: string;
  reason: string;
};

const errorReason = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
};

const COUNTDOWN_TICK_MS = 100;

const computeRemainingSeconds = (elapsedMs: number): number =>
  Math.max(0, Math.ceil((ACTION_TOAST_DELAY_MS - elapsedMs) / 1000));

const computeProgress = (elapsedMs: number): number =>
  Math.max(0, 1 - elapsedMs / ACTION_TOAST_DELAY_MS);

export type ConsoleActionQueue = {
  pending: ConsolePendingActionView | null;
  error: ConsoleActionError | null;
  enqueue: (action: ConsoleQueuedAction) => void;
  undo: () => void;
  dismissError: () => void;
};

export const useConsoleActionQueue = (): ConsoleActionQueue => {
  const [pending, setPending] = useState<ConsolePendingActionView | null>(null);
  const [error, setError] = useState<ConsoleActionError | null>(null);
  const actionRef = useRef<ConsoleQueuedAction | null>(null);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const committedRef = useRef<boolean>(false);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runCommit = useCallback((action: ConsoleQueuedAction): void => {
    action.commit().catch((cause: unknown) => {
      setError({ message: action.message, reason: errorReason(cause) });
    });
  }, []);

  const commitPending = useCallback((): void => {
    const action = actionRef.current;
    clearTimer();
    actionRef.current = null;
    setPending(null);
    if (action !== null && !committedRef.current) {
      committedRef.current = true;
      runCommit(action);
    }
  }, [clearTimer, runCommit]);

  const undo = useCallback((): void => {
    clearTimer();
    actionRef.current = null;
    committedRef.current = true;
    setPending(null);
  }, [clearTimer]);

  const dismissError = useCallback((): void => {
    setError(null);
  }, []);

  const enqueue = useCallback(
    (action: ConsoleQueuedAction): void => {
      if (actionRef.current !== null && !committedRef.current) {
        const previous = actionRef.current;
        clearTimer();
        committedRef.current = true;
        runCommit(previous);
      }
      committedRef.current = false;
      actionRef.current = action;
      startRef.current = Date.now();
      setPending({
        message: action.message,
        color: action.color,
        remainingSeconds: computeRemainingSeconds(0),
        progress: computeProgress(0),
      });
      action.advance();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        if (elapsed >= ACTION_TOAST_DELAY_MS) {
          commitPending();
          return;
        }
        setPending({
          message: action.message,
          color: action.color,
          remainingSeconds: computeRemainingSeconds(elapsed),
          progress: computeProgress(elapsed),
        });
      }, COUNTDOWN_TICK_MS);
    },
    [clearTimer, commitPending, runCommit],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { pending, error, enqueue, undo, dismissError };
};
