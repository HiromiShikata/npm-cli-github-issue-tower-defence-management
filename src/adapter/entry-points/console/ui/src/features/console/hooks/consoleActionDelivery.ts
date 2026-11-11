import type {
  ConsoleOfflinePayload,
  ConsoleOfflineQueuedAction,
} from './useConsoleActionQueue';

export const CONSOLE_ACTION_QUEUE_STORAGE_KEY = 'console-offline-action-queue';

export const loadPersistedConsoleActions = (): ConsoleOfflineQueuedAction[] => {
  try {
    const raw = localStorage.getItem(CONSOLE_ACTION_QUEUE_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as ConsoleOfflineQueuedAction[])
      : [];
  } catch {
    return [];
  }
};

export const savePersistedConsoleActions = (
  actions: ConsoleOfflineQueuedAction[],
): void => {
  localStorage.setItem(
    CONSOLE_ACTION_QUEUE_STORAGE_KEY,
    JSON.stringify(actions),
  );
};

export const persistConsoleAction = (
  action: ConsoleOfflineQueuedAction,
): void => {
  savePersistedConsoleActions([...loadPersistedConsoleActions(), action]);
};

export const removePersistedConsoleAction = (id: string): void => {
  savePersistedConsoleActions(
    loadPersistedConsoleActions().filter((action) => action.id !== id),
  );
};

export const deliverConsoleAction = async (
  action: ConsoleOfflineQueuedAction,
  keepalive = false,
): Promise<unknown> => {
  const response = await fetch(action.apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...action.requestBody, actionId: action.id }),
    ...(keepalive ? { keepalive: true } : {}),
  });
  const payload: unknown =
    typeof response.json === 'function'
      ? await response
          .json()
          .catch(async () =>
            typeof response.text === 'function' ? response.text() : {},
          )
      : typeof response.text === 'function'
        ? await response.text()
        : {};
  if (!response.ok) {
    const reason =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : typeof payload === 'string' && payload.length > 0
          ? payload
          : `HTTP ${response.status}`;
    throw new Error(reason);
  }
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'ok' in payload &&
    (payload as { ok: unknown }).ok === false
  ) {
    throw new Error(
      'error' in payload
        ? String((payload as { error: unknown }).error)
        : 'Action failed',
    );
  }
  return payload;
};

export const payloadWithActionId = (
  payload: ConsoleOfflinePayload,
  actionId: string,
): ConsoleOfflinePayload => ({
  ...payload,
  requestBody: { ...payload.requestBody, actionId },
});
