import { useState } from 'react';
import type {
  ConsoleActionError,
  ConsolePendingActionView,
} from '../../hooks/useConsoleActionQueue';
import { splitActionToastStack } from '../../logic/actionToastStack';
import { ConsoleErrorToast, ConsoleUndoToast } from './ConsoleUndoToast';

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
        remainingSeconds={item.entry.remainingSeconds}
        progress={item.entry.progress}
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
