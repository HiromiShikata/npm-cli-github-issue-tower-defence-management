import { colorFromEnum } from '../../logic/colors';
import { AWAITING_WORKSPACE_NAME } from '../../logic/operations';
import type { ConsoleFieldOption } from '../../logic/types';

export type ConsoleOkAndAwaitingWorkspaceActionsProps = {
  statusOptions: ConsoleFieldOption[];
  onOkAndAwaitingWorkspace: (option: ConsoleFieldOption) => void;
};

export const ConsoleOkAndAwaitingWorkspaceActions = ({
  statusOptions,
  onOkAndAwaitingWorkspace,
}: ConsoleOkAndAwaitingWorkspaceActionsProps) => {
  const option = statusOptions.find(
    (o) => o.name.toLowerCase() === AWAITING_WORKSPACE_NAME.toLowerCase(),
  );

  if (option === undefined) {
    return null;
  }

  const palette = colorFromEnum(option.color);

  return (
    <div className="console-op-group">
      <button
        type="button"
        className="console-op-button"
        style={{
          color: palette.fg,
          borderColor: palette.border,
          backgroundColor: palette.bg,
        }}
        onClick={() => onOkAndAwaitingWorkspace(option)}
      >
        ok &amp; Awaiting Workspace
      </button>
    </div>
  );
};
