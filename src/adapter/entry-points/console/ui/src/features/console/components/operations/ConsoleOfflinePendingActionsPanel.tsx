import type { ConsoleToastColor } from '../../logic/actionToast';
import type { ConsolePullRequestStatus } from '../../logic/types';

export type ConsoleOfflinePendingActionItem = {
  id: string;
  message: string;
  color: ConsoleToastColor;
  itemNumber: number;
  isPr: boolean;
  currentTitle: string | null;
  currentState: 'open' | 'closed' | null;
  currentPrStatus: ConsolePullRequestStatus | null;
  fetchError: boolean;
};

export type ConsoleOfflinePendingActionsPanelProps = {
  actions: ConsoleOfflinePendingActionItem[];
  isOnline: boolean;
  isConfirming: boolean;
  onConfirm: (id: string) => void;
  onDiscard: (id: string) => void;
};

const itemLabel = (item: ConsoleOfflinePendingActionItem): string =>
  `${item.isPr ? 'PR' : 'Issue'} #${item.itemNumber}`;

const stateLabel = (state: 'open' | 'closed' | null): string => {
  if (state === null) return 'loading…';
  return state;
};

const prStatusLabel = (prStatus: ConsolePullRequestStatus): string => {
  const parts: string[] = [];
  parts.push(`CI: ${prStatus.isCiStateSuccess ? 'pass' : 'fail'}`);
  parts.push(`Merge: ${prStatus.mergeableStatus.toLowerCase()}`);
  if (prStatus.isBranchOutOfDate) {
    parts.push('branch out of date');
  }
  return parts.join(' · ');
};

const targetText = (action: ConsoleOfflinePendingActionItem): string => {
  if (action.fetchError) {
    return `${itemLabel(action)} — failed to load current state`;
  }
  if (action.currentTitle === null) {
    return `${itemLabel(action)} — loading current state…`;
  }
  return `${itemLabel(action)} — ${action.currentTitle} (${stateLabel(action.currentState)})`;
};

export const ConsoleOfflinePendingActionsPanel = ({
  actions,
  isOnline,
  isConfirming,
  onConfirm,
  onDiscard,
}: ConsoleOfflinePendingActionsPanelProps) => {
  if (actions.length === 0) return null;

  return (
    <section
      className="console-offline-panel"
      aria-label="Offline actions queue"
    >
      <div className="console-offline-panel-header">
        {actions.length} action{actions.length !== 1 ? 's' : ''} held
        {isOnline
          ? ' — confirm each before sending'
          : ' — awaiting connectivity'}
      </div>
      {actions.map((action) => (
        <div
          key={action.id}
          className={`console-offline-panel-item console-offline-panel-item-${action.color}`}
        >
          <div className="console-offline-panel-item-message">
            {action.message}
          </div>
          <div className="console-offline-panel-item-target">
            {targetText(action)}
          </div>
          {action.fetchError && (
            <div className="console-offline-panel-item-fetch-error">
              Failed to load current state — sending will act on the last known
              state
            </div>
          )}
          {isOnline &&
            action.isPr &&
            action.currentPrStatus !== null &&
            !action.fetchError && (
              <div className="console-offline-panel-item-pr-status">
                {prStatusLabel(action.currentPrStatus)}
              </div>
            )}
          <div className="console-offline-panel-item-controls">
            {isOnline && (
              <button
                type="button"
                className="console-offline-panel-confirm"
                disabled={
                  isConfirming ||
                  (action.currentTitle === null && !action.fetchError)
                }
                onClick={() => onConfirm(action.id)}
              >
                Send
              </button>
            )}
            <button
              type="button"
              className="console-offline-panel-discard"
              onClick={() => onDiscard(action.id)}
            >
              Discard
            </button>
          </div>
        </div>
      ))}
    </section>
  );
};
