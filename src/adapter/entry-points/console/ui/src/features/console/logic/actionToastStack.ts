export type ConsoleActionToastStackEntry = { id: string; createdAt: number };

export type ConsoleActionToastStackSplitResult<
  T extends ConsoleActionToastStackEntry,
> = {
  visibleEntries: T[];
  collapsedEntries: T[];
  collapsedCount: number;
};

export const splitActionToastStack = <T extends ConsoleActionToastStackEntry>(
  entries: T[],
  displayLimit: number,
): ConsoleActionToastStackSplitResult<T> => {
  const sortedByCreatedAtAscending = [...entries].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  if (sortedByCreatedAtAscending.length <= displayLimit) {
    return {
      visibleEntries: sortedByCreatedAtAscending,
      collapsedEntries: [],
      collapsedCount: 0,
    };
  }
  const collapsedCount = sortedByCreatedAtAscending.length - displayLimit;
  return {
    visibleEntries: sortedByCreatedAtAscending.slice(collapsedCount),
    collapsedEntries: sortedByCreatedAtAscending.slice(0, collapsedCount),
    collapsedCount,
  };
};
