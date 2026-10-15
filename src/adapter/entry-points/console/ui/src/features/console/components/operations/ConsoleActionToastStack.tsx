import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const STACK_BOTTOM_INSET_PX = 12;
const STACK_ENTRY_GAP_PX = 8;
const STACK_TOGGLE_KEY = 'console-action-toast-stack-toggle';

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
    ...pendingEntries.map((entry): ConsoleActionToastStackItem => ({
      kind: 'pending',
      id: entry.id,
      createdAt: entry.createdAt,
      entry,
    })),
    ...errorEntries.map((entry): ConsoleActionToastStackItem => ({
      kind: 'error',
      id: entry.id,
      createdAt: entry.createdAt,
      entry,
    })),
  ];

  const { visibleEntries, collapsedEntries, collapsedCount } =
    splitActionToastStack(items, displayLimit);

  const stackOrderBottomToTop: string[] = [
    ...[...visibleEntries].reverse().map((item) => item.id),
    ...(isExpanded
      ? [...collapsedEntries].reverse().map((item) => item.id)
      : []),
    ...(collapsedCount > 0 ? [STACK_TOGGLE_KEY] : []),
  ];

  const toggleElementRef = useRef<HTMLButtonElement | null>(null);
  const entryElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useLayoutEffect(() => {
    let bottom = STACK_BOTTOM_INSET_PX;
    for (const key of stackOrderBottomToTop) {
      const element =
        key === STACK_TOGGLE_KEY
          ? toggleElementRef.current
          : (entryElementsRef.current.get(key)?.firstElementChild ?? null);
      if (!(element instanceof HTMLElement)) continue;
      element.style.bottom = `${bottom}px`;
      bottom += element.getBoundingClientRect().height + STACK_ENTRY_GAP_PX;
    }
  });

  if (items.length === 0) {
    return null;
  }

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

  const renderStackEntry = (item: ConsoleActionToastStackItem) => (
    <div
      key={item.id}
      className="console-action-toast-stack-entry"
      ref={(element) => {
        if (element) {
          entryElementsRef.current.set(item.id, element);
        } else {
          entryElementsRef.current.delete(item.id);
        }
      }}
    >
      {renderItem(item)}
    </div>
  );

  return (
    <div className="console-action-toast-stack">
      {collapsedCount > 0 && (
        <button
          type="button"
          ref={toggleElementRef}
          className="console-action-toast-stack-toggle"
          onClick={() => setIsExpanded((previous) => !previous)}
        >
          {isExpanded ? 'Show less' : `+${collapsedCount} more`}
        </button>
      )}
      {isExpanded && collapsedEntries.map(renderStackEntry)}
      {visibleEntries.map(renderStackEntry)}
    </div>
  );
};
