import type { ConsoleListItem } from '../types';
import type { ConsoleItemCache } from './consoleItemCache';

export const CONSOLE_PREFETCH_CONCURRENCY = 2;

const reportPrefetchFailure = (item: ConsoleListItem, cause: unknown): void => {
  const message = cause instanceof Error ? cause.message : String(cause);
  console.warn(
    `Console prefetch failed for ${item.repo}#${item.number}: ${message}`,
  );
};

const prefetchSingleItem = async (
  cache: ConsoleItemCache,
  item: ConsoleListItem,
): Promise<void> => {
  await cache.getItemBody(item.repo, item.number);
  if (item.isPr) {
    await cache.getPullRequestDetail(item.repo, item.number);
    return;
  }
  const related = await cache.getRelatedPullRequests(item.repo, item.number);
  await Promise.all(
    related.map((pullRequest) =>
      cache.getPullRequestDetail(pullRequest.repo, pullRequest.number),
    ),
  );
};

export const prefetchConsoleItems = async (
  cache: ConsoleItemCache,
  items: ConsoleListItem[],
  concurrency: number = CONSOLE_PREFETCH_CONCURRENCY,
): Promise<void> => {
  const queue = [...items];
  const runWorker = async (): Promise<void> => {
    for (;;) {
      const next = queue.shift();
      if (next === undefined) {
        return;
      }
      const outcome = await prefetchSingleItem(cache, next).then(
        () => null,
        (cause: unknown) => cause,
      );
      if (outcome !== null) {
        reportPrefetchFailure(next, outcome);
      }
    }
  };
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
};
