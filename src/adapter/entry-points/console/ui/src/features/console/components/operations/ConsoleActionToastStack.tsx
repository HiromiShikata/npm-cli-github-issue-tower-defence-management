import { useEffect, useState } from 'react';
import type {
  ConsoleActionError,
  ConsolePendingActionView,
} from '../../hooks/useConsoleActionQueue';
import { ACTION_TOAST_DELAY_MS } from '../../logic/actionToast';
import { splitActionToastStack } from '../../logic/actionToastStack';
import { ConsoleErrorToast, ConsoleUndoToast } from './ConsoleUndoToast';

const computeRemainingSeconds = (elapsedMs: number): number =>
  Math.max(0, Math.ceil((ACTION_TOAST_DELAY_MS - elapsedMs) / 1000));

const computeProgress = (elapsedMs: number): number =>
  Math.max(0, 1 - elapsedMs / ACTION_TOAST_DELAY_MS);

export type ConsoleActionToastStackProps = {
  pendingEntries: ConsolePendingActionView[];
  errorEntries: ConsoleActionError[];
  displayLimit: number;
  onUndo: (id: string) => void;
  onDismiss: (id: string) => void;
  onDismissError: (id: string) => void;
};

type ConsoleActionToastStackItem =
  | {
      kind: 'pending';
      id: string;
      createdAt: number;
      entry: ConsolePendingActionView;
    }
  | {
      kind: 'error';
      id: string;
      createdAt: number;
      entry: ConsoleActionError;
    };

export const ConsoleActionToastStack = ({
  pendingEntries,
  errorEntries,
  displayLimit,
  onUndo,
  onDismiss,
  onDismissError,
}: ConsoleActionToastStackProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const hasPendingEntries = pendingEntries.length > 0;
  useEffect(() => {
    if (!hasPendingEntries) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [hasPendingEntries]);

  const items: ConsoleActionToastStackItem[] = [
    ...pendingEntries.map(
      (entry): ConsoleActionToastStackItem => ({
        kind: 'pending',
        id: entry.id,
        createdAt: entry.createdAt,
        entry,
      }),
    ),
    ...errorEntries.map(
      (entry): ConsoleActionToastStackItem => ({
        kind: 'error',
        id: entry.id,
        createdAt: entry.createdAt,
        entry,
      }),
    ),
  ];

  if (items.length === 0) {
    return null;
  }

  const { visibleEntries, collapsedEntries, collapsedCount } =
    splitActionToastStack(items, displayLimit);

  const renderItem = (item: ConsoleActionToastStackItem) =>
    item.kind === 'pending' ? (
      <ConsoleUndoToast
        key={item.id}
        message={item.entry.message}
        color={item.entry.color}
        remainingSeconds={computeRemainingSeconds(now - item.entry.createdAt)}
        progress={computeProgress(now - item.entry.createdAt)}
        onUndo={() => onUndo(item.id)}
        onDismiss={() => onDismiss(item.id)}
      />
    ) : (
      <ConsoleErrorToast
        key={item.id}
        title={item.entry.message}
        message={`Operation failed: ${item.entry.reason}`}
        onDismiss={() => onDismissError(item.id)}
        onRetry={
          item.entry.retry !== undefined
            ? () => {
                onDismissError(item.id);
                item.entry.retry?.();
              }
            : undefined
        }
      />
    );

  return (
    <div className="console-action-toast-stack">
      {collapsedCount > 0 && (
        <button
          type="button"
          className="console-action-toast-stack-toggle"
          onClick={() => setIsExpanded((previous) => !previous)}
        >
          {isExpanded ? 'Show less' : `+${collapsedCount} more`}
        </button>
      )}
      {isExpanded && collapsedEntries.length > 0 && (
        <div className="console-action-toast-stack-expanded">
          {collapsedEntries.map(renderItem)}
        </div>
      )}
      {visibleEntries.map(renderItem)}
    </div>
  );
};
