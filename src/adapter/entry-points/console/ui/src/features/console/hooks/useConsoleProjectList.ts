import { useEffect, useState } from 'react';
import { fetchProjectList } from '../lib/consoleApi';

export type ConsoleProjectListState = {
  pjcodes: string[];
  projectUrls: Record<string, string> | null;
  fleetTaskCreateUrl: string | null;
  nameWithOwnerByPjcode: Record<string, string> | null;
  isLoading: boolean;
  error: Error | null;
};

export const useConsoleProjectList = (): ConsoleProjectListState => {
  const [pjcodes, setPjcodes] = useState<string[]>([]);
  const [projectUrls, setProjectUrls] = useState<Record<string, string> | null>(
    null,
  );
  const [fleetTaskCreateUrl, setFleetTaskCreateUrl] = useState<string | null>(
    null,
  );
  const [nameWithOwnerByPjcode, setNameWithOwnerByPjcode] = useState<Record<
    string,
    string
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchProjectList()
      .then((result) => {
        if (!cancelled) {
          setPjcodes(result.pjcodes);
          setProjectUrls(result.projectUrls);
          setFleetTaskCreateUrl(result.fleetTaskCreateUrl);
          setNameWithOwnerByPjcode(result.nameWithOwnerByPjcode);
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

  return {
    pjcodes,
    projectUrls,
    fleetTaskCreateUrl,
    nameWithOwnerByPjcode,
    isLoading,
    error,
  };
};
