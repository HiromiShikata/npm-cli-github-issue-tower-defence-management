import { useCallback } from 'react';
import { clearAllCommentExpandedStates } from '../logic/commentExpandedStorage';
import type { ConsoleTabName } from '../logic/types';

export const useConsoleTabSelectHandler = (
  selectTab: (tab: ConsoleTabName) => void,
): ((tab: ConsoleTabName) => void) =>
  useCallback(
    (tab: ConsoleTabName): void => {
      clearAllCommentExpandedStates();
      selectTab(tab);
    },
    [selectTab],
  );
