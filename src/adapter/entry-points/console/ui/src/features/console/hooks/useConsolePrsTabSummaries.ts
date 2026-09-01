import { useEffect, useState } from 'react';
import type { ResourceCache } from '../lib/resourceCache';
import { extractExecutiveSummaryFromComments } from '../logic/executiveSummary';
import type { ConsoleComment, ConsoleListItem } from '../logic/types';

const cacheKey = (item: ConsoleListItem): string =>
  `${item.repo}#${item.number}`;

export const useConsolePrsTabSummaries = (
  items: ConsoleListItem[],
  commentsCache: ResourceCache<ConsoleComment[]>,
  enabled: boolean,
): Record<string, string | null> => {
  const [summaries, setSummaries] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    for (const item of items) {
      const key = cacheKey(item);
      const cached = commentsCache.peek(key);
      if (cached !== undefined) {
        const summary = extractExecutiveSummaryFromComments(cached);
        if (!cancelled) {
          setSummaries((prev) => {
            if (prev[item.projectItemId] === summary) return prev;
            return { ...prev, [item.projectItemId]: summary };
          });
        }
        continue;
      }

      commentsCache
        .load(key, item.url)
        .then((comments) => {
          if (cancelled) {
            return;
          }
          const summary = extractExecutiveSummaryFromComments(comments);
          setSummaries((prev) => {
            if (prev[item.projectItemId] === summary) return prev;
            return { ...prev, [item.projectItemId]: summary };
          });
        })
        .catch(() => {
          if (!cancelled) {
            setSummaries((prev) => {
              if (prev[item.projectItemId] === null) return prev;
              return { ...prev, [item.projectItemId]: null };
            });
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [items, commentsCache, enabled]);

  return summaries;
};
