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
      onClick={() => onSetNextActionDate('snooze_1day')}
    >
      +1 day
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_1week')}
    >
      {isManualTriage ? '+1 week and skip' : '+1 week'}
    </button>
  </div>
);
