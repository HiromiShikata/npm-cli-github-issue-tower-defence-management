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
      +1h
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_3hours')}
    >
      +3h
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_6hours')}
    >
      +6h
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_1day')}
    >
      +1d
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_2days')}
    >
      +2d
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_3days')}
    >
      +3d
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_5days')}
    >
      +5d
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_1week')}
    >
      {isManualTriage ? '+1w skip' : '+1w'}
    </button>
    <button
      type="button"
      className="console-op-button console-op-button-snooze"
      onClick={() => onSetNextActionDate('snooze_1month')}
    >
      +1mo
    </button>
  </div>
);
