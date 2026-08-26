import { useEffect, useState } from 'react';
import { fetchProjectList } from '../lib/consoleApi';

export type ConsoleProjectListState = {
  pjcodes: string[];
  isLoading: boolean;
  error: Error | null;
};

export const useConsoleProjectList = (): ConsoleProjectListState => {
  const [pjcodes, setPjcodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchProjectList()
      .then((list) => {
        if (!cancelled) {
          setPjcodes(list);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { pjcodes, isLoading, error };
};
