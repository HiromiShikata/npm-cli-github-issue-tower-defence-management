import {
  type ConsoleOperationHandlers,
  isManualTriageTab,
} from '../../logic/operations';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleTabName,
} from '../../logic/types';
import { ConsoleCloseActions } from './ConsoleCloseActions';
import { ConsoleNextActionDateActions } from './ConsoleNextActionDateActions';
import { ConsoleOkAndAwaitingWorkspaceActions } from './ConsoleOkAndAwaitingWorkspaceActions';
import { ConsolePullRequestReviewActions } from './ConsolePullRequestReviewActions';
import { ConsoleStatusActions } from './ConsoleStatusActions';

export type ConsoleOperationBarProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  hasPullRequest: boolean;
  rejectEnabled: boolean;
  statusOptions: ConsoleFieldOption[];
  handlers: ConsoleOperationHandlers;
};

export const ConsoleOperationMenu = ({
  tab,
  hasPullRequest,
  rejectEnabled,
  statusOptions,
  handlers,
}: ConsoleOperationBarProps) => {
  return (
    <div className="console-operation-bar">
      <ConsoleOkAndAwaitingWorkspaceActions
        statusOptions={statusOptions}
        onOkAndAwaitingWorkspace={handlers.onOkAndAwaitingWorkspace}
      />
      {hasPullRequest && (
        <ConsolePullRequestReviewActions
          onReview={handlers.onReview}
          rejectEnabled={rejectEnabled}
        />
      )}
      <ConsoleNextActionDateActions
        isManualTriage={isManualTriageTab(tab)}
        onSetNextActionDate={handlers.onSetNextActionDate}
      />
      <ConsoleStatusActions
        statusOptions={statusOptions}
        onSetStatus={handlers.onSetStatus}
        onSetInTmuxByHuman={handlers.onSetInTmuxByHuman}
      />
      <ConsoleCloseActions onClose={handlers.onClose} />
    </div>
  );
};
