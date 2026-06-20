import type { ConsoleCloseAction } from '../../logic/operations';

export type ConsoleCloseButtonGroupProps = {
  onClose: (action: ConsoleCloseAction) => void;
};

export const ConsoleCloseActions = ({
  onClose,
}: ConsoleCloseButtonGroupProps) => (
  <div className="console-op-group">
    <button
      type="button"
      className="console-op-button"
      onClick={() => onClose('close')}
    >
      Close
    </button>
    <button
      type="button"
      className="console-op-button"
      onClick={() => onClose('close_not_planned')}
    >
      Close as not planned
    </button>
  </div>
);
