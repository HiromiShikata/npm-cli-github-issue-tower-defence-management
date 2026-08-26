import { useEffect, useState } from 'react';

export type ConsoleProjectListState = {
  pjcodes: string[];
  isLoading: boolean;
  error: Error | null;
};

const parseProjectList = (payload: unknown): string[] => {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    return [];
  }
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.pjcodes)) {
    return [];
  }
  return record.pjcodes.filter(
    (entry): entry is string => typeof entry === 'string',
  );
};

export const useConsoleProjectList = (): ConsoleProjectListState => {
  const [pjcodes, setPjcodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch('/api/projects')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload: unknown = await response.json();
        if (!cancelled) {
          setPjcodes(parseProjectList(payload));
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
