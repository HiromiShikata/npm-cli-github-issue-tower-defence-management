export type TimerSettings = {
  timerMode: boolean;
  projectMinutes: Record<string, number>;
};

export const TIMER_SETTINGS_KEY = 'tdpm-timer-settings';

const defaultSettings = (): TimerSettings => ({
  timerMode: false,
  projectMinutes: {},
});

export const readTimerSettings = (): TimerSettings => {
  if (typeof localStorage === 'undefined') {
    return defaultSettings();
  }
  const raw = localStorage.getItem(TIMER_SETTINGS_KEY);
  if (raw === null) {
    return defaultSettings();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return defaultSettings();
    }
    const record = parsed as Record<string, unknown>;
    const timerMode =
      typeof record.timerMode === 'boolean' ? record.timerMode : false;
    const projectMinutesRaw = record.projectMinutes;
    const projectMinutes: Record<string, number> =
      projectMinutesRaw !== null &&
      typeof projectMinutesRaw === 'object' &&
      !Array.isArray(projectMinutesRaw)
        ? Object.fromEntries(
            Object.entries(projectMinutesRaw as Record<string, unknown>)
              .filter(([, v]) => typeof v === 'number')
              .map(([k, v]) => [k, v as number]),
          )
        : {};
    return { timerMode, projectMinutes };
  } catch {
    return defaultSettings();
  }
};

export const writeTimerSettings = (settings: TimerSettings): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(settings));
  }
};

export const findNextPjcodeWithMinutes = (
  pjcodes: string[],
  currentPjcode: string | null,
  projectMinutes: Record<string, number>,
): string | null => {
  if (pjcodes.length === 0) {
    return null;
  }
  const currentIndex =
    currentPjcode !== null ? pjcodes.indexOf(currentPjcode) : -1;
  const startIndex =
    currentIndex === -1 ? 0 : (currentIndex + 1) % pjcodes.length;
  const count = currentIndex === -1 ? pjcodes.length : pjcodes.length - 1;
  for (let i = 0; i < count; i++) {
    const index = (startIndex + i) % pjcodes.length;
    const pjcode = pjcodes[index];
    if ((projectMinutes[pjcode] ?? 0) > 0) {
      return pjcode;
    }
  }
  return null;
};
