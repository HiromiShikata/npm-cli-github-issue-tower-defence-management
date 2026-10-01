import { useEffect, useRef } from 'react';
import {
  consoleAutomaticProjectNavigationDecide,
  DEFAULT_TIMER_MINUTES,
} from '../../../../../../../../domain/usecases/ConsoleAutomaticProjectNavigationDecideUseCase';
import { navigatePush } from '../lib/navigation';
import type { ConsoleActionWriteState } from './useConsoleActionQueue';

export const useConsoleAutomaticProjectNavigation = (
  timerMode: boolean,
  isTimerExpired: (minutes: number) => boolean,
  prsCount: number,
  todoByHumanCount: number,
  pjcode: string | null,
  pjcodes: string[],
  projectMinutes: Record<string, number>,
  prsSnapshotLoaded: boolean,
  todoByHumanSnapshotLoaded: boolean,
  prsSnapshotFromCache: boolean,
  todoByHumanSnapshotFromCache: boolean,
  explicitlySelectedPjcode: string | null,
  writeState: ConsoleActionWriteState,
): void => {
  const skipCountRef = useRef(0);
  const evaluatedPjcodeRef = useRef<string | null>(null);
  const lastHandledSucceededAttemptRef = useRef(0);

  useEffect(() => {
    if (!timerMode || pjcode === null) {
      skipCountRef.current = 0;
      evaluatedPjcodeRef.current = null;
      return;
    }
    if (
      writeState.status === 'unconfirmed' ||
      writeState.status === 'failed' ||
      writeState.status === 'offline'
    ) {
      return;
    }

    const checkTimerElapsed =
      writeState.status === 'succeeded' &&
      writeState.attempt !== lastHandledSucceededAttemptRef.current;
    if (writeState.status === 'succeeded') {
      lastHandledSucceededAttemptRef.current = writeState.attempt;
    }

    const decision = consoleAutomaticProjectNavigationDecide({
      checkTimerElapsed,
      timerElapsed: isTimerExpired(projectMinutes[pjcode] ?? DEFAULT_TIMER_MINUTES),
      remainingCountIsZero: prsCount === 0 && todoByHumanCount === 0,
      snapshotsReady:
        prsSnapshotLoaded &&
        todoByHumanSnapshotLoaded &&
        !prsSnapshotFromCache &&
        !todoByHumanSnapshotFromCache,
      explicitlySelectedPjcodeMatchesCurrent:
        explicitlySelectedPjcode !== null && pjcode === explicitlySelectedPjcode,
      pjcode,
      pjcodes,
      projectMinutes,
      skipCount: skipCountRef.current,
      evaluatedPjcode: evaluatedPjcodeRef.current,
    });

    skipCountRef.current = decision.nextSkipCount;
    evaluatedPjcodeRef.current = decision.nextEvaluatedPjcode;
    if (decision.targetPjcode !== null) {
      navigatePush(`/projects/${decision.targetPjcode}/todo-by-human`);
    }
  }, [
    timerMode,
    isTimerExpired,
    prsCount,
    todoByHumanCount,
    pjcode,
    pjcodes,
    projectMinutes,
    prsSnapshotLoaded,
    todoByHumanSnapshotLoaded,
    prsSnapshotFromCache,
    todoByHumanSnapshotFromCache,
    explicitlySelectedPjcode,
    writeState,
  ]);
};
