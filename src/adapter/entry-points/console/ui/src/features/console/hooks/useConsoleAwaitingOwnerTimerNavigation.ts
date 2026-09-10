import { useEffect, useRef } from 'react';
import { navigatePush } from '../lib/navigation';
import { findNextPjcodeWithMinutes } from '../logic/timerSettings';

export const useConsoleAwaitingOwnerTimerNavigation = (
  timerMode: boolean,
  prsCount: number,
  pjcode: string | null,
  pjcodes: string[],
  projectMinutes: Record<string, number>,
): void => {
  const previousPrsCountRef = useRef(prsCount);
  const previousPjcodeRef = useRef(pjcode);

  useEffect(() => {
    const previousCount = previousPrsCountRef.current;
    const previousPjcode = previousPjcodeRef.current;

    previousPrsCountRef.current = prsCount;
    previousPjcodeRef.current = pjcode;

    if (!timerMode) return;
    if (previousPjcode !== pjcode) {
      previousPrsCountRef.current = 0;
      return;
    }
    if (previousCount > 0 && prsCount === 0) {
      const nextPjcode = findNextPjcodeWithMinutes(
        pjcodes,
        pjcode,
        projectMinutes,
      );
      if (nextPjcode !== null) {
        navigatePush(`/projects/${nextPjcode}`);
      }
    }
  }, [timerMode, prsCount, pjcode, pjcodes, projectMinutes]);
};
