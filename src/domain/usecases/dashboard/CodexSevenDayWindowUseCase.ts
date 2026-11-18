export const CODEX_SEVEN_DAY_WINDOW_MINUTES = 10080;

export const CODEX_SEVEN_DAY_WINDOW_DIR_NAME = 'codex-seven-day-window';

const RATE_LIMITS_MARKER = '"rate_limits"';

export type CodexSevenDayRateLimitObservation = {
  capturedAt: string;
  usedPercent: number;
  resetsAtEpochSeconds: number;
};

export type CodexSevenDayWindowState = 'observed' | 'no-data' | 'error';

export type CodexSevenDayWindowStatus = {
  codexHome: string;
  state: CodexSevenDayWindowState;
  usedPercent: number | null;
  resetsAtEpochSeconds: number | null;
  capturedAt: string | null;
  errorMessage: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const sevenDayWindowOf = (
  window: unknown,
): { usedPercent: number; resetsAtEpochSeconds: number } | null => {
  if (!isRecord(window)) {
    return null;
  }
  if (window.window_minutes !== CODEX_SEVEN_DAY_WINDOW_MINUTES) {
    return null;
  }
  const usedPercent = finiteNumberOrNull(window.used_percent);
  const resetsAtEpochSeconds = finiteNumberOrNull(window.resets_at);
  if (usedPercent === null || resetsAtEpochSeconds === null) {
    return null;
  }
  return { usedPercent, resetsAtEpochSeconds };
};

const isValidTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export const parseCodexRateLimitLine = (
  line: string,
): CodexSevenDayRateLimitObservation | null => {
  if (!line.includes(RATE_LIMITS_MARKER)) {
    return null;
  }
  const parsed: unknown = JSON.parse(line);
  if (!isRecord(parsed) || !isRecord(parsed.payload)) {
    return null;
  }
  const rateLimits = parsed.payload.rate_limits;
  if (!isRecord(rateLimits) || !isValidTimestamp(parsed.timestamp)) {
    return null;
  }
  const window =
    sevenDayWindowOf(rateLimits.primary) ??
    sevenDayWindowOf(rateLimits.secondary);
  if (window === null) {
    return null;
  }
  return { capturedAt: parsed.timestamp, ...window };
};

export const findLatestCodexSevenDayRateLimit = (
  lines: string[],
): CodexSevenDayRateLimitObservation | null => {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const observation = parseCodexRateLimitLine(lines[index] ?? '');
    if (observation !== null) {
      return observation;
    }
  }
  return null;
};

export const isCodexSevenDayWindowReset = (
  resetsAtEpochSeconds: number,
  nowEpochSeconds: number,
): boolean => nowEpochSeconds >= resetsAtEpochSeconds;
