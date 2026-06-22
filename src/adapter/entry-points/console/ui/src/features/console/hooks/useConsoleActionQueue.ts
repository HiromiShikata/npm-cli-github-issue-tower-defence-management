import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTION_TOAST_DELAY_MS,
  type ConsoleToastColor,
} from '../logic/actionToast';

export type ConsoleQueuedAction = {
  message: string;
  color: ConsoleToastColor;
  commit: () => void;
  advance: () => void;
};

export type ConsolePendingActionView = {
  message: string;
  color: ConsoleToastColor;
  remainingSeconds: number;
  progress: number;
};

const COUNTDOWN_TICK_MS = 100;

const computeRemainingSeconds = (elapsedMs: number): number =>
  Math.max(0, Math.ceil((ACTION_TOAST_DELAY_MS - elapsedMs) / 1000));

const computeProgress = (elapsedMs: number): number =>
  Math.max(0, 1 - elapsedMs / ACTION_TOAST_DELAY_MS);

export type ConsoleActionQueue = {
  pending: ConsolePendingActionView | null;
  enqueue: (action: ConsoleQueuedAction) => void;
  undo: () => void;
};

export const useConsoleActionQueue = (): ConsoleActionQueue => {
  const [pending, setPending] = useState<ConsolePendingActionView | null>(null);
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

  const commitPending = useCallback((): void => {
    const action = actionRef.current;
    clearTimer();
    actionRef.current = null;
    setPending(null);
    if (action !== null && !committedRef.current) {
      committedRef.current = true;
      action.commit();
    }
  }, [clearTimer]);

  const undo = useCallback((): void => {
    clearTimer();
    actionRef.current = null;
    committedRef.current = true;
    setPending(null);
  }, [clearTimer]);

  const enqueue = useCallback(
    (action: ConsoleQueuedAction): void => {
      if (actionRef.current !== null && !committedRef.current) {
        const previous = actionRef.current;
        clearTimer();
        committedRef.current = true;
        previous.commit();
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
    [clearTimer, commitPending],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { pending, enqueue, undo };
};
