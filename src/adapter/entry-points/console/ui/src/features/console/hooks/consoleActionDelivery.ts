import type {
  ConsoleOfflinePayload,
  ConsoleOfflineQueuedAction,
} from './useConsoleActionQueue';
import { overlayCloseSuccessRecord } from './useConsoleOverlay';

export const CONSOLE_ACTION_DELIVERY_STORAGE_KEY =
  'console-action-delivery-queue';
const inFlightActionIds = new Set<string>();

export const loadPersistedConsoleActions = (): ConsoleOfflineQueuedAction[] => {
  try {
    const raw = localStorage.getItem(CONSOLE_ACTION_DELIVERY_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? (parsed as ConsoleOfflineQueuedAction[])
        : [];
    }
    return [];
  } catch {
    return [];
  }
};

export const savePersistedConsoleActions = (
  actions: ConsoleOfflineQueuedAction[],
): void => {
  localStorage.setItem(
    CONSOLE_ACTION_DELIVERY_STORAGE_KEY,
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
  overlayCloseSuccessRecord(action.requestBody, payload);
  return payload;
};

export const deliverPersistedConsoleAction = async (
  action: ConsoleOfflineQueuedAction,
  keepalive = false,
): Promise<unknown> => {
  if (inFlightActionIds.has(action.id)) return undefined;
  inFlightActionIds.add(action.id);
  try {
    const result = await deliverConsoleAction(action, keepalive);
    removePersistedConsoleAction(action.id);
    return result;
  } catch (error) {
    inFlightActionIds.delete(action.id);
    throw error;
  }
};

export const deliverPersistedConsoleActions = async (): Promise<void> => {
  await Promise.all(
    loadPersistedConsoleActions().map((action) =>
      deliverPersistedConsoleAction(action).catch(() => undefined),
    ),
  );
};

export const payloadWithActionId = (
  payload: ConsoleOfflinePayload,
  actionId: string,
): ConsoleOfflinePayload => ({
  ...payload,
  requestBody: { ...payload.requestBody, actionId },
});
