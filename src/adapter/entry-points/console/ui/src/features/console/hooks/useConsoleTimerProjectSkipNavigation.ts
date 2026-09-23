import { useEffect, useRef } from 'react';
import { navigatePush } from '../lib/navigation';
import {
  DEFAULT_TIMER_MINUTES,
  findNextPjcodeWithMinutes,
} from '../logic/timerSettings';

export const useConsoleTimerProjectSkipNavigation = (
  timerMode: boolean,
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
): void => {
  const skipCountRef = useRef(0);
  const evaluatedPjcodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!timerMode || pjcode === null) {
      skipCountRef.current = 0;
      evaluatedPjcodeRef.current = null;
      return;
    }
    if (!prsSnapshotLoaded || !todoByHumanSnapshotLoaded) {
      return;
    }
    if (prsSnapshotFromCache || todoByHumanSnapshotFromCache) {
      return;
    }
    if (evaluatedPjcodeRef.current === pjcode) {
      return;
    }

    if (prsCount > 0 || todoByHumanCount > 0) {
      skipCountRef.current = 0;
      evaluatedPjcodeRef.current = null;
      return;
    }

    if (
      explicitlySelectedPjcode !== null &&
      pjcode === explicitlySelectedPjcode
    ) {
      return;
    }

    if (pjcodes.length === 0) {
      return;
    }

    const pjcodesWithMinutes = pjcodes.filter(
      (code) => (projectMinutes[code] ?? DEFAULT_TIMER_MINUTES) > 0,
    );
    if (skipCountRef.current >= pjcodesWithMinutes.length - 1) {
      evaluatedPjcodeRef.current = pjcode;
      skipCountRef.current = 0;
      return;
    }

    evaluatedPjcodeRef.current = pjcode;
    skipCountRef.current += 1;
    const nextPjcode = findNextPjcodeWithMinutes(
      pjcodes,
      pjcode,
      projectMinutes,
    );
    if (nextPjcode !== null) {
      navigatePush(`/projects/${nextPjcode}/todo-by-human`);
    } else {
      skipCountRef.current = 0;
    }
  }, [
    timerMode,
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
  ]);
};
