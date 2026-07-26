import { useEffect, useState } from 'react';
import type { ResourceCache } from '../lib/resourceCache';
import type { ConsoleIssueState } from '../logic/types';

export const useConsoleReferenceLink = (
  cache: ResourceCache<ConsoleIssueState>,
  url: string,
): ConsoleIssueState | null => {
  const [state, setState] = useState<ConsoleIssueState | null>(
    () => cache.peek(url) ?? null,
  );

  useEffect(() => {
    const cached = cache.peek(url);
    if (cached !== undefined) {
      setState(cached);
      return;
    }
    let cancelled = false;
    setState(null);
    cache
      .load(url, url)
      .then((value) => {
        if (!cancelled) {
          setState(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cache, url]);

  return state;
};
