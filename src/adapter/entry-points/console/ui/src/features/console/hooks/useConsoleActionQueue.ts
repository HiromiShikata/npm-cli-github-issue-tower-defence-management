import { useCallback, useEffect, useRef, useState } from "react";
import { postConsoleOperationRecord } from "../lib/consoleApi";
import {
	ACTION_TOAST_DELAY_MS,
	type ConsoleToastColor,
} from "../logic/actionToast";

export type ConsoleOfflinePayload = {
	itemUrl: string;
	projectItemId: string;
	itemNumber: number;
	repo: string;
	isPr: boolean;
	apiPath: string;
	requestBody: Record<string, unknown>;
};

export type ConsoleOfflineQueuedAction = {
	id: string;
	message: string;
	color: ConsoleToastColor;
	enqueuedAt: number;
} & ConsoleOfflinePayload;

export type ConsoleQueuedAction = {
	message: string;
	color: ConsoleToastColor;
	commit: () => Promise<void>;
	advance: () => void;
	offline?: ConsoleOfflinePayload;
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

const OFFLINE_QUEUE_STORAGE_KEY = "console-offline-action-queue";

const loadOfflineQueue = (): ConsoleOfflineQueuedAction[] => {
	try {
		const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
		if (raw === null) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed)
			? (parsed as ConsoleOfflineQueuedAction[])
			: [];
	} catch {
		return [];
	}
};

const saveOfflineQueue = (actions: ConsoleOfflineQueuedAction[]): void => {
	localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(actions));
};

const isNetworkError = (error: unknown): boolean => error instanceof TypeError;

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
	offlineActions: ConsoleOfflineQueuedAction[];
	enqueue: (action: ConsoleQueuedAction) => void;
	undo: () => void;
	dismissError: () => void;
	confirmOfflineAction: (id: string) => Promise<void>;
	discardOfflineAction: (id: string) => void;
};

export const useConsoleActionQueue = (): ConsoleActionQueue => {
	const [pending, setPending] = useState<ConsolePendingActionView | null>(null);
	const [error, setError] = useState<ConsoleActionError | null>(null);
	const [offlineActions, setOfflineActions] =
		useState<ConsoleOfflineQueuedAction[]>(loadOfflineQueue);
	const offlineActionsRef =
		useRef<ConsoleOfflineQueuedAction[]>(offlineActions);
	offlineActionsRef.current = offlineActions;

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

	const addToOfflineQueue = useCallback((action: ConsoleQueuedAction): void => {
		if (action.offline === undefined) return;
		const offlineAction: ConsoleOfflineQueuedAction = {
			id: crypto.randomUUID(),
			message: action.message,
			color: action.color,
			enqueuedAt: Date.now(),
			...action.offline,
		};
		setOfflineActions((prev) => {
			const next = [...prev, offlineAction];
			saveOfflineQueue(next);
			return next;
		});
	}, []);

	const runCommit = useCallback(
		(action: ConsoleQueuedAction): void => {
			action.commit().catch((cause: unknown) => {
				if (isNetworkError(cause) && action.offline !== undefined) {
					addToOfflineQueue(action);
				} else {
					setError({ message: action.message, reason: errorReason(cause) });
				}
			});
		},
		[addToOfflineQueue],
	);

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
				await postConsoleOperationRecord(action.apiPath, action.requestBody);
				discardOfflineAction(id);
			} catch (cause: unknown) {
				if (!isNetworkError(cause)) {
					setError({ message: action.message, reason: errorReason(cause) });
					discardOfflineAction(id);
				}
			}
		},
		[discardOfflineAction],
	);

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

	return {
		pending,
		error,
		offlineActions,
		enqueue,
		undo,
		dismissError,
		confirmOfflineAction,
		discardOfflineAction,
	};
};
