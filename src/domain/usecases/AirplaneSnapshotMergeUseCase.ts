export type AirplaneSnapshotForMerge = {
  capturedAt: string;
  tabs: Record<string, unknown>;
  items: Record<string, unknown>;
  failures: string[];
};

export type AirplaneSnapshotMergeResult =
  | { status: 'error'; failures: string[] }
  | { status: 'on'; snapshot: AirplaneSnapshotForMerge };

export const airplaneSnapshotMerge = (
  previousSnapshot: AirplaneSnapshotForMerge | null,
  newResult: AirplaneSnapshotForMerge,
): AirplaneSnapshotMergeResult => {
  if (
    Object.keys(newResult.items).length === 0 &&
    newResult.failures.length > 0
  ) {
    return { status: 'error', failures: newResult.failures };
  }

  return {
    status: 'on',
    snapshot: {
      capturedAt: newResult.capturedAt,
      tabs:
        previousSnapshot !== null
          ? { ...previousSnapshot.tabs, ...newResult.tabs }
          : newResult.tabs,
      items:
        previousSnapshot !== null
          ? { ...previousSnapshot.items, ...newResult.items }
          : newResult.items,
      failures: newResult.failures,
    },
  };
};
