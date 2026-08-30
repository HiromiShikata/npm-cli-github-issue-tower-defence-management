import { useEffect, useState } from 'react';
import { fetchProjectList } from '../lib/consoleApi';

export type ConsoleProjectListState = {
  pjcodes: string[];
  workflowImprovementIssueUrl: string | null;
  isLoading: boolean;
  error: Error | null;
};

export const useConsoleProjectList = (): ConsoleProjectListState => {
  const [pjcodes, setPjcodes] = useState<string[]>([]);
  const [workflowImprovementIssueUrl, setWorkflowImprovementIssueUrl] =
    useState<string | null>(null);
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
          setWorkflowImprovementIssueUrl(result.workflowImprovementIssueUrl);
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

  return { pjcodes, workflowImprovementIssueUrl, isLoading, error };
};
