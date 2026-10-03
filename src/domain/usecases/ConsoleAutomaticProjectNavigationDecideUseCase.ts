export const DEFAULT_TIMER_MINUTES = 15;

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
    if ((projectMinutes[pjcode] ?? DEFAULT_TIMER_MINUTES) > 0) {
      return pjcode;
    }
  }
  return null;
};

export type ConsoleAutomaticProjectNavigationDecideInput = {
  checkTimerElapsed: boolean;
  timerElapsed: boolean;
  remainingCountIsZero: boolean;
  snapshotsReady: boolean;
  explicitlySelectedPjcodeMatchesCurrent: boolean;
  taskOpen?: boolean;
  aProjectGainedRemainingMinutesSinceTheCurrentProjectWasLastEvaluated?: boolean;
  pjcode: string;
  pjcodes: string[];
  projectMinutes: Record<string, number>;
  skipCount: number;
  evaluatedPjcode: string | null;
};

export type ConsoleAutomaticProjectNavigationDecideResult = {
  targetPjcode: string | null;
  nextSkipCount: number;
  nextEvaluatedPjcode: string | null;
};

export const consoleAutomaticProjectNavigationDecide = (
  input: ConsoleAutomaticProjectNavigationDecideInput,
): ConsoleAutomaticProjectNavigationDecideResult => {
  if (input.checkTimerElapsed && input.timerElapsed) {
    return {
      targetPjcode: findNextPjcodeWithMinutes(
        input.pjcodes,
        input.pjcode,
        input.projectMinutes,
      ),
      nextSkipCount: input.skipCount,
      nextEvaluatedPjcode: input.evaluatedPjcode,
    };
  }

  const unchanged: ConsoleAutomaticProjectNavigationDecideResult = {
    targetPjcode: null,
    nextSkipCount: input.skipCount,
    nextEvaluatedPjcode: input.evaluatedPjcode,
  };

  if (!input.snapshotsReady) {
    return unchanged;
  }
  if (
    input.evaluatedPjcode === input.pjcode &&
    !input.aProjectGainedRemainingMinutesSinceTheCurrentProjectWasLastEvaluated &&
    !input.explicitlySelectedPjcodeMatchesCurrent
  ) {
    return unchanged;
  }

  if (!input.remainingCountIsZero) {
    return { targetPjcode: null, nextSkipCount: 0, nextEvaluatedPjcode: null };
  }
  if (input.taskOpen) {
    return unchanged;
  }
  if (input.pjcodes.length === 0) {
    return unchanged;
  }

  const pjcodesWithMinutes = input.pjcodes.filter(
    (code) => (input.projectMinutes[code] ?? DEFAULT_TIMER_MINUTES) > 0,
  );
  const skipCountForThisReEvaluation =
    (input.evaluatedPjcode === input.pjcode &&
      input.aProjectGainedRemainingMinutesSinceTheCurrentProjectWasLastEvaluated) ||
    input.explicitlySelectedPjcodeMatchesCurrent
      ? 0
      : input.skipCount;

  if (skipCountForThisReEvaluation >= pjcodesWithMinutes.length - 1) {
    return {
      targetPjcode: null,
      nextSkipCount: 0,
      nextEvaluatedPjcode: input.pjcode,
    };
  }

  const nextPjcode = findNextPjcodeWithMinutes(
    input.pjcodes,
    input.pjcode,
    input.projectMinutes,
  );
  if (nextPjcode !== null) {
    return {
      targetPjcode: nextPjcode,
      nextSkipCount: skipCountForThisReEvaluation + 1,
      nextEvaluatedPjcode: input.pjcode,
    };
  }
  return {
    targetPjcode: null,
    nextSkipCount: 0,
    nextEvaluatedPjcode: input.pjcode,
  };
};
