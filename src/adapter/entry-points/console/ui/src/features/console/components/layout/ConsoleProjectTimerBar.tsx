import { computeProjectTimerState } from '../../logic/projectTimer';

export type ConsoleProjectTimerBarProps = {
  timerEndsAt: string | null;
  timerTotalSeconds: number | null;
  now: number;
};

const formatRemainingTime = (remainingSeconds: number): string => {
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};

export const ConsoleProjectTimerBar = ({
  timerEndsAt,
  timerTotalSeconds,
  now,
}: ConsoleProjectTimerBarProps) => {
  const state = computeProjectTimerState(timerEndsAt, timerTotalSeconds, now);
  if (state === null) {
    return null;
  }
  const isExpired = state.remainingSeconds === 0;
  return (
    <div className="console-project-timer-bar">
      <div
        className="console-project-timer-bar-track"
        role="progressbar"
        aria-valuenow={state.remainingSeconds}
        aria-valuemin={0}
        aria-valuemax={state.totalSeconds}
      >
        <div
          className="console-project-timer-bar-fill"
          style={{ width: `${state.remainingRatio * 100}%` }}
        />
      </div>
      <span className="console-project-timer-bar-label">
        {isExpired
          ? 'Move to next project'
          : formatRemainingTime(state.remainingSeconds)}
      </span>
    </div>
  );
};
