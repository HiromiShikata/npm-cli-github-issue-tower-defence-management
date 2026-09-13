import { useEffect, useRef } from 'react';
import { navigatePush } from '../lib/navigation';
import { findNextPjcodeWithMinutes } from '../logic/timerSettings';

export const useConsoleAwaitingOwnerTimerNavigation = (
  timerMode: boolean,
  prsCount: number,
  pjcode: string | null,
  pjcodes: string[],
  projectMinutes: Record<string, number>,
  prsSnapshotFromCache: boolean = false,
): void => {
  const previousPrsCountRef = useRef(prsCount);
  const previousPjcodeRef = useRef(pjcode);
  const previousFromCacheRef = useRef(prsSnapshotFromCache);

  useEffect(() => {
    const previousCount = previousPrsCountRef.current;
    const previousPjcode = previousPjcodeRef.current;
    const previousFromCache = previousFromCacheRef.current;

    previousPrsCountRef.current = prsCount;
    previousPjcodeRef.current = pjcode;
    previousFromCacheRef.current = prsSnapshotFromCache;

    if (!timerMode) return;
    if (previousPjcode !== pjcode) {
      previousPrsCountRef.current = 0;
      return;
    }
    if (previousFromCache && !prsSnapshotFromCache) {
      previousPrsCountRef.current = prsCount;
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
  }, [
    timerMode,
    prsCount,
    prsSnapshotFromCache,
    pjcode,
    pjcodes,
    projectMinutes,
  ]);
};
