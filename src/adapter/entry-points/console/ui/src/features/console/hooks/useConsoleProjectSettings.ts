import { useCallback, useEffect, useRef, useState } from 'react';
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

const SETTINGS_HASH = '#settings';

const isSettingsHash = (): boolean =>
  typeof window !== 'undefined' && window.location.hash === SETTINGS_HASH;

export const useConsoleProjectSettings = (
  pjcode: string | null,
): ConsoleProjectSettingsState => {
  const [isOpen, setIsOpen] = useState(isSettingsHash);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const prevHashRef = useRef<string>('');

  useEffect(() => {
    if (!isOpen || pjcode === null) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchProjectReadmeConfig(pjcode)
      .then((config) => {
        if (!cancelled) {
          setInputValue(
            config.maximumPreparingIssuesCount !== null
              ? String(config.maximumPreparingIssuesCount)
              : '',
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load settings',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, pjcode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const sync = (): void => {
      const nowSettings = window.location.hash === SETTINGS_HASH;
      if (!nowSettings) {
        setError(null);
      }
      setIsOpen(nowSettings);
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const open = useCallback(() => {
    if (pjcode === null) {
      return;
    }
    if (typeof window !== 'undefined') {
      prevHashRef.current = window.location.hash;
      window.history.pushState({}, '', SETTINGS_HASH);
    }
    setIsOpen(true);
  }, [pjcode]);

  const close = useCallback(() => {
    if (typeof window !== 'undefined') {
      const restoredHash = prevHashRef.current;
      const url = `${window.location.pathname}${window.location.search}${restoredHash}`;
      window.history.pushState({}, '', url);
    }
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
        if (typeof window !== 'undefined') {
          const restoredHash = prevHashRef.current;
          const url = `${window.location.pathname}${window.location.search}${restoredHash}`;
          window.history.pushState({}, '', url);
        }
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
