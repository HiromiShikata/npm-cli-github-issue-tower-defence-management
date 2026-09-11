import { useCallback } from 'react';
import { clearAllCommentExpandedStates } from '../logic/commentExpandedStorage';

export const useConsoleProjectSelectHandler = (
  selectProject: (pjcode: string) => void,
): ((pjcode: string) => void) =>
  useCallback(
    (pjcode: string): void => {
      clearAllCommentExpandedStates();
      selectProject(pjcode);
    },
    [selectProject],
  );
