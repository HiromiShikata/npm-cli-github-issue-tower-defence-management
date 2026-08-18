import type { ConsoleToastColor } from '../../logic/actionToast';

export type ConsoleOfflinePendingActionItem = {
  id: string;
  message: string;
  color: ConsoleToastColor;
  itemNumber: number;
  isPr: boolean;
  currentTitle: string | null;
  currentState: 'open' | 'closed' | null;
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
      {isOnline &&
        actions.map((action) => (
          <div
            key={action.id}
            className={`console-offline-panel-item console-offline-panel-item-${action.color}`}
          >
            <div className="console-offline-panel-item-message">
              {action.message}
            </div>
            <div className="console-offline-panel-item-target">
              {itemLabel(action)}
              {action.currentTitle !== null
                ? ` — ${action.currentTitle} (${stateLabel(action.currentState)})`
                : ' — loading current state…'}
            </div>
            <div className="console-offline-panel-item-controls">
              <button
                type="button"
                className="console-offline-panel-confirm"
                disabled={isConfirming || action.currentTitle === null}
                onClick={() => onConfirm(action.id)}
              >
                Send
              </button>
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
