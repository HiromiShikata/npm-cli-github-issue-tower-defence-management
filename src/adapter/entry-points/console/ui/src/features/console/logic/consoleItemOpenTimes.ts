const consoleItemOpenedAtMs = new Map<string, number>();

export type ConsoleActionTiming = {
  openedToActionMs?: number;
  actionDescription: string;
};

export const withConsoleActionTiming = <
  T extends { requestBody: Record<string, unknown> },
>(
  payload: T,
  timing: ConsoleActionTiming,
): T => {
  if (timing.openedToActionMs === undefined) return payload;
  return {
    ...payload,
    requestBody: {
      ...payload.requestBody,
      openedToActionMs: timing.openedToActionMs,
      actionDescription: timing.actionDescription,
    },
  };
};

export const recordConsoleItemOpened = (
  itemUrl: string,
  openedAtMs: number,
): void => {
  consoleItemOpenedAtMs.set(itemUrl, openedAtMs);
};

export const readConsoleItemOpenedAt = (itemUrl: string): number | undefined =>
  consoleItemOpenedAtMs.get(itemUrl);

export const clearConsoleItemOpenTimesForTest = (): void => {
  consoleItemOpenedAtMs.clear();
};

export const computeOpenedToActionMs = (
  openedAtMs: number | undefined,
  pressedAtMs: number,
): number | undefined => {
  if (
    openedAtMs === undefined ||
    !Number.isFinite(openedAtMs) ||
    !Number.isFinite(pressedAtMs)
  ) {
    return undefined;
  }
  const elapsedMs = pressedAtMs - openedAtMs;
  return Number.isFinite(elapsedMs) && elapsedMs >= 0
    ? Math.floor(elapsedMs)
    : undefined;
};
