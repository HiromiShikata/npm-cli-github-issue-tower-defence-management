import type { ConsoleFieldOption } from '../../logic/types';

export type ConsoleOkAndAwaitingWorkspaceActionsProps = {
  statusOptions: ConsoleFieldOption[];
  onOkAndAwaitingWorkspace: (option: ConsoleFieldOption) => void;
};

const AWAITING_WORKSPACE_NAME = 'awaiting workspace';

export const ConsoleOkAndAwaitingWorkspaceActions = ({
  statusOptions,
  onOkAndAwaitingWorkspace,
}: ConsoleOkAndAwaitingWorkspaceActionsProps) => {
  const option = statusOptions.find(
    (o) => o.name.toLowerCase() === AWAITING_WORKSPACE_NAME,
  );

  if (option === undefined) {
    return null;
  }

  return (
    <div className="console-op-group">
      <button
        type="button"
        className="console-op-button console-op-button-approve"
        onClick={() => onOkAndAwaitingWorkspace(option)}
      >
        ok &amp; Awaiting Workspace
      </button>
    </div>
  );
};
