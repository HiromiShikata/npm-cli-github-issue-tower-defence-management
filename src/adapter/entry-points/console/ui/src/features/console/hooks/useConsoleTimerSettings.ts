import { useCallback, useState } from 'react';
import {
  readTimerSettings,
  type TimerSettings,
  writeTimerSettings,
} from '../logic/timerSettings';

export type ConsoleTimerSettingsState = {
  timerMode: boolean;
  projectMinutes: Record<string, number>;
  isOpen: boolean;
  draftTimerMode: boolean;
  draftProjectMinutes: Record<string, number>;
  openSettings: () => void;
  closeSettings: () => void;
  saveSettings: () => void;
  toggleDraftTimerMode: (enabled: boolean) => void;
  changeDraftMinutes: (pjcode: string, minutes: number) => void;
};

export const useConsoleTimerSettings = (): ConsoleTimerSettingsState => {
  const [saved, setSaved] = useState<TimerSettings>(readTimerSettings);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<TimerSettings>(saved);

  const openSettings = useCallback(() => {
    setSaved((currentSaved) => {
      setDraft(currentSaved);
      return currentSaved;
    });
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  const saveSettings = useCallback(() => {
    setDraft((currentDraft) => {
      writeTimerSettings(currentDraft);
      setSaved(currentDraft);
      return currentDraft;
    });
    setIsOpen(false);
  }, []);

  const toggleDraftTimerMode = useCallback((enabled: boolean) => {
    setDraft((prev) => ({ ...prev, timerMode: enabled }));
  }, []);

  const changeDraftMinutes = useCallback((pjcode: string, minutes: number) => {
    setDraft((prev) => ({
      ...prev,
      projectMinutes: { ...prev.projectMinutes, [pjcode]: minutes },
    }));
  }, []);

  return {
    timerMode: saved.timerMode,
    projectMinutes: saved.projectMinutes,
    isOpen,
    draftTimerMode: draft.timerMode,
    draftProjectMinutes: draft.projectMinutes,
    openSettings,
    closeSettings,
    saveSettings,
    toggleDraftTimerMode,
    changeDraftMinutes,
  };
};
