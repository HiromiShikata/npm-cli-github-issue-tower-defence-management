import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryEntry,
} from './types';

export type ConsoleStoryPendingMove = {
  projectItemId: string;
  target: ConsoleFieldOption;
  storySetAtMs: number;
};

const countsAsOpenBadge = (item: ConsoleListItem): boolean => {
  if (item.isClosed !== undefined) {
    return !item.isClosed;
  }
  return item.status !== 'Done';
};

export const moveTaskToStory = (
  entries: ConsoleStoryEntry[],
  projectItemId: string,
  target: ConsoleFieldOption,
): ConsoleStoryEntry[] => {
  const sourceEntry = entries.find((entry) =>
    (entry.items ?? []).some((item) => item.projectItemId === projectItemId),
  );
  const movingItem = (sourceEntry?.items ?? []).find(
    (item) => item.projectItemId === projectItemId,
  );
  if (
    sourceEntry === undefined ||
    movingItem === undefined ||
    sourceEntry.storyOptionId === target.id
  ) {
    return entries;
  }
  const countsAsOpen = countsAsOpenBadge(movingItem) ? 1 : 0;
  return entries.map((entry) => {
    if (entry.storyOptionId === sourceEntry.storyOptionId) {
      return {
        ...entry,
        items: (entry.items ?? []).filter(
          (item) => item.projectItemId !== projectItemId,
        ),
        openItemCount: Math.max(0, entry.openItemCount - countsAsOpen),
      };
    }
    if (entry.storyOptionId === target.id) {
      return {
        ...entry,
        items: [...(entry.items ?? []), { ...movingItem, story: target.name }],
        openItemCount: entry.openItemCount + countsAsOpen,
      };
    }
    return entry;
  });
};

export const consoleStorySetAtMsRead = (
  response: unknown,
): number | undefined => {
  if (response === null || typeof response !== 'object') {
    return undefined;
  }
  const { storySetAtMs } = response as { storySetAtMs?: unknown };
  if (typeof storySetAtMs !== 'number' || !Number.isFinite(storySetAtMs)) {
    return undefined;
  }
  return storySetAtMs;
};

const isMoveAheadOfStoriesList = (
  move: ConsoleStoryPendingMove,
  storiesGeneratedAt: string | null,
): boolean => {
  if (storiesGeneratedAt === null) {
    return true;
  }
  const storiesGeneratedAtMs = Date.parse(storiesGeneratedAt);
  return (
    !Number.isNaN(storiesGeneratedAtMs) &&
    storiesGeneratedAtMs < move.storySetAtMs
  );
};

export const consoleStoryPendingMovesRemaining = (
  moves: ConsoleStoryPendingMove[],
  storiesGeneratedAt: string | null,
): ConsoleStoryPendingMove[] =>
  moves.filter((move) => isMoveAheadOfStoriesList(move, storiesGeneratedAt));

export const consoleStoryEntriesWithPendingMoves = (
  stories: ConsoleStoryEntry[],
  moves: ConsoleStoryPendingMove[],
  storiesGeneratedAt: string | null,
): ConsoleStoryEntry[] =>
  consoleStoryPendingMovesRemaining(moves, storiesGeneratedAt).reduce(
    (entries, move) =>
      moveTaskToStory(entries, move.projectItemId, move.target),
    stories,
  );
