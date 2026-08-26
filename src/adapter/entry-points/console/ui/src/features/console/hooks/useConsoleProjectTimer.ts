import { useCallback, useRef } from 'react';

export type ConsoleProjectTimerState = {
  isTimerExpired: (minutes: number) => boolean;
};

export const useConsoleProjectTimer = (
  pjcode: string | null,
): ConsoleProjectTimerState => {
  const pjcodeRef = useRef(pjcode);
  const startRef = useRef<number>(Date.now());

  if (pjcodeRef.current !== pjcode) {
    pjcodeRef.current = pjcode;
    startRef.current = Date.now();
  }

  const isTimerExpired = useCallback((minutes: number): boolean => {
    if (minutes <= 0) {
      return false;
    }
    return Date.now() - startRef.current >= minutes * 60 * 1000;
  }, []);

  return { isTimerExpired };
};
