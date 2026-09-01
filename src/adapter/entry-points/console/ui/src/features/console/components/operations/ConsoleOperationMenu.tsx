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
import { ConsoleDangerousActions } from './ConsoleDangerousActions';
import { ConsoleNextActionDateActions } from './ConsoleNextActionDateActions';
import { ConsolePullRequestReviewActions } from './ConsolePullRequestReviewActions';
import { ConsoleRareActions } from './ConsoleRareActions';
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
      <div className="console-op-group-bottom-row">
        <div className="console-op-group-left-pair">
          <ConsoleRareActions
            onSetDependedIssueUrl={handlers.onSetDependedIssueUrl}
          />
          <ConsoleDangerousActions
            onDeleteAllComments={handlers.onDeleteAllComments}
          />
        </div>
        <ConsoleCloseActions onClose={handlers.onClose} />
      </div>
    </div>
  );
};
