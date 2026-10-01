export {
  DEFAULT_TIMER_MINUTES,
  findNextPjcodeWithMinutes,
} from '../../../../../../../../domain/usecases/ConsoleAutomaticProjectNavigationDecideUseCase';

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
