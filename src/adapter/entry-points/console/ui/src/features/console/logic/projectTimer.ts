export type ProjectTimerState = {
  remainingSeconds: number;
  remainingRatio: number;
  totalSeconds: number;
};

export const computeProjectTimerState = (
  timerEndsAt: string | null,
  timerTotalSeconds: number | null,
  nowMs: number,
): ProjectTimerState | null => {
  if (timerEndsAt === null || timerTotalSeconds === null) {
    return null;
  }
  const endsAtMs = new Date(timerEndsAt).getTime();
  const remainingMs = endsAtMs - nowMs;
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const remainingRatio = Math.max(0, Math.min(1, remainingSeconds / timerTotalSeconds));
  return { remainingSeconds, remainingRatio, totalSeconds: timerTotalSeconds };
};
