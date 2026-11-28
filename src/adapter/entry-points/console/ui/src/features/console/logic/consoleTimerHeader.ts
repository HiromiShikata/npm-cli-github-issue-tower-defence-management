import {
  DEFAULT_TIMER_MINUTES,
  findNextPjcodeWithMinutes,
} from '../../../../../../../../domain/usecases/ConsoleAutomaticProjectNavigationDecideUseCase';

const MILLISECONDS_PER_MINUTE = 60000;

export type ConsoleTimerHeaderTone = 'normal' | 'warning' | 'danger' | 'muted';

export type ConsoleTimerHeaderView = {
  tone: ConsoleTimerHeaderTone;
  timeText: string;
  nextText: string;
};

export type ConsoleTimerHeaderViewInput = {
  pjcode: string | null;
  pjcodes: string[];
  projectMinutes: Record<string, number>;
  projectTodoByHumanCounts: Record<string, number>;
  projectAwaitingOwnerCounts: Record<string, number>;
  timerStartedAtMs: number;
  nowMs: number;
};

type ConsoleTimerHeaderViewBuildInput = Omit<
  ConsoleTimerHeaderViewInput,
  'projectMinutes' | 'projectTodoByHumanCounts' | 'projectAwaitingOwnerCounts'
> & {
  projectMinutes: Record<string, number | undefined>;
  projectTodoByHumanCounts: Record<string, number | undefined>;
  projectAwaitingOwnerCounts: Record<string, number | undefined>;
};

const numberRecordWithoutUndefined = (
  record: Record<string, number | undefined>,
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

export const formatConsoleTimerRemaining = (
  remainingSeconds: number,
): string => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const buildConsoleTimerHeaderView = (
  input: ConsoleTimerHeaderViewBuildInput,
): ConsoleTimerHeaderView | null => {
  if (input.pjcode === null) {
    return null;
  }
  const minutes = input.projectMinutes[input.pjcode] ?? DEFAULT_TIMER_MINUTES;
  if (minutes <= 0) {
    return null;
  }

  const remainingMilliseconds =
    minutes * MILLISECONDS_PER_MINUTE - (input.nowMs - input.timerStartedAtMs);
  const nextPjcode = findNextPjcodeWithMinutes(
    input.pjcodes,
    input.pjcode,
    numberRecordWithoutUndefined(input.projectMinutes),
    numberRecordWithoutUndefined(input.projectTodoByHumanCounts),
    numberRecordWithoutUndefined(input.projectAwaitingOwnerCounts),
  );
  const remainingSeconds = Math.max(0, Math.ceil(remainingMilliseconds / 1000));

  if (nextPjcode === null) {
    return {
      tone: 'muted',
      timeText: formatConsoleTimerRemaining(remainingSeconds),
      nextText: 'none',
    };
  }
  if (remainingMilliseconds <= 0) {
    return { tone: 'danger', timeText: 'next submit', nextText: nextPjcode };
  }
  return {
    tone:
      remainingMilliseconds < MILLISECONDS_PER_MINUTE ? 'warning' : 'normal',
    timeText: formatConsoleTimerRemaining(remainingSeconds),
    nextText: nextPjcode,
  };
};
