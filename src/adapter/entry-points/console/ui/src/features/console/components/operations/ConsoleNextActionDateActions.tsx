import type { ConsoleNextActionDateAction } from '../../logic/operations';

export type ConsoleNextActionDateGroupProps = {
  isManualTriage: boolean;
  onSetNextActionDate: (action: ConsoleNextActionDateAction) => void;
};

export const ConsoleNextActionDateActions = ({
  isManualTriage,
  onSetNextActionDate,
}: ConsoleNextActionDateGroupProps) => (
  <div className="console-op-group">
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_1hour')}
    >
      +1 hour
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_3hours')}
    >
      +3 hours
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_6hours')}
    >
      +6 hours
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_1day')}
    >
      +1 day
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_2days')}
    >
      +2 days
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_3days')}
    >
      +3 days
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_5days')}
    >
      +5 days
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_1week')}
    >
      {isManualTriage ? '+1 week and skip' : '+1 week'}
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_1month')}
    >
      +1 month
    </button>
  </div>
);
