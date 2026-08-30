import { useCallback, useEffect, useState } from 'react';
import {
  fetchProjectReadmeConfig,
  postProjectMaxPreparingUpdate,
} from '../lib/consoleApi';

export type ConsoleProjectSettingsState = {
  isOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  inputValue: string;
  open: () => void;
  close: () => void;
  changeInput: (value: string) => void;
  save: (count: number) => Promise<void>;
};

export const useConsoleProjectSettings = (
  pjcode: string | null,
): ConsoleProjectSettingsState => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

  const open = useCallback(async () => {
    if (pjcode === null) {
      return;
    }
    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    try {
      const config = await fetchProjectReadmeConfig(pjcode);
      setInputValue(
        config.maximumPreparingIssuesCount !== null
          ? String(config.maximumPreparingIssuesCount)
          : '',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, [pjcode]);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  const changeInput = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const save = useCallback(
    async (count: number) => {
      if (pjcode === null) {
        return;
      }
      setIsSaving(true);
      setError(null);
      try {
        await postProjectMaxPreparingUpdate({
          pjcode,
          maximumPreparingIssuesCount: count,
        });
        setIsOpen(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to save settings',
        );
      } finally {
        setIsSaving(false);
      }
    },
    [pjcode],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  return {
    isOpen,
    isLoading,
    isSaving,
    error,
    inputValue,
    open,
    close,
    changeInput,
    save,
  };
};
