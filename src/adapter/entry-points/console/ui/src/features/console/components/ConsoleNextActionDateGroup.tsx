import type { ConsoleNextActionDateAction } from '../operations';

export type ConsoleNextActionDateGroupProps = {
  isTodoByHuman: boolean;
  onSetNextActionDate: (action: ConsoleNextActionDateAction) => void;
};

export const ConsoleNextActionDateGroup = ({
  isTodoByHuman,
  onSetNextActionDate,
}: ConsoleNextActionDateGroupProps) => (
  <div className="console-op-group">
    <button
      type="button"
      className="console-op-button"
      onClick={() => onSetNextActionDate('snooze_1day')}
    >
      +1 day
    </button>
    <button
      type="button"
      className="console-op-button"
      onClick={() => onSetNextActionDate('snooze_1week')}
    >
      {isTodoByHuman ? '+1 week and skip' : '+1 week'}
    </button>
  </div>
);
