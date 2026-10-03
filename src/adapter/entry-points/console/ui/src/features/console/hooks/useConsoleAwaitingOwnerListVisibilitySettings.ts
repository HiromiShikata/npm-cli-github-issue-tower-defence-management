import { useCallback, useEffect, useState } from 'react';
import {
  readAwaitingOwnerListVisibilitySettings,
  writeAwaitingOwnerListVisibilitySettings,
} from '../logic/awaitingOwnerListVisibilitySettings';

export type ConsoleAwaitingOwnerListVisibilitySettingsState = {
  showExecutiveSummaryAndActionButton: boolean;
  draftShowExecutiveSummaryAndActionButton: boolean;
  toggleDraft: (enabled: boolean) => void;
  save: () => void;
};

export const useConsoleAwaitingOwnerListVisibilitySettings = (
  isMaxSettingsOpen: boolean,
): ConsoleAwaitingOwnerListVisibilitySettingsState => {
  const [saved, setSaved] = useState<boolean>(
    () =>
      readAwaitingOwnerListVisibilitySettings()
        .showExecutiveSummaryAndActionButton,
  );
  const [draft, setDraft] = useState<boolean>(saved);

  useEffect(() => {
    if (isMaxSettingsOpen) {
      setDraft(saved);
    }
  }, [isMaxSettingsOpen, saved]);

  const toggleDraft = useCallback((enabled: boolean) => {
    setDraft(enabled);
  }, []);

  const save = useCallback(() => {
    setDraft((currentDraft) => {
      writeAwaitingOwnerListVisibilitySettings({
        showExecutiveSummaryAndActionButton: currentDraft,
      });
      setSaved(currentDraft);
      return currentDraft;
    });
  }, []);

  return {
    showExecutiveSummaryAndActionButton: saved,
    draftShowExecutiveSummaryAndActionButton: draft,
    toggleDraft,
    save,
  };
};
