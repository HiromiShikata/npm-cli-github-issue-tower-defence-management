import {
  type ConsoleOperationHandlers,
  isManualTriageTab,
} from '../../logic/operations';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleTabName,
} from '../../logic/types';
import { ConsoleAgentSelectActions } from './ConsoleAgentSelectActions';
import { ConsoleCloseActions } from './ConsoleCloseActions';
import { ConsoleDangerousActions } from './ConsoleDangerousActions';
import { ConsoleNextActionDateActions } from './ConsoleNextActionDateActions';
import { ConsolePullRequestReviewActions } from './ConsolePullRequestReviewActions';
import { ConsoleRareActions } from './ConsoleRareActions';
import { ConsoleStatusActions } from './ConsoleStatusActions';
import { ConsoleStorySelectActions } from './ConsoleStorySelectActions';

export type ConsoleOperationBarProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  hasPullRequest: boolean;
  rejectEnabled: boolean;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  currentStoryName: string | null;
  agentOptions: ConsoleFieldOption[];
  currentAgentName: string | null;
  handlers: ConsoleOperationHandlers;
  storyNameForDeletion?: string | null;
};

export const ConsoleOperationMenu = ({
  tab,
  hasPullRequest,
  rejectEnabled,
  statusOptions,
  storyOptions,
  currentStoryName,
  agentOptions,
  currentAgentName,
  handlers,
  storyNameForDeletion,
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
      <ConsoleStorySelectActions
        storyOptions={storyOptions}
        currentStoryName={currentStoryName}
        onSetStory={handlers.onSetStory}
      />
      <ConsoleAgentSelectActions
        agentOptions={agentOptions}
        currentAgentName={currentAgentName}
        onSetAgent={handlers.onSetAgent}
      />
      <div className="console-op-group-bottom-row">
        <div className="console-op-group-left-pair">
          <ConsoleRareActions
            onSetDependedIssueUrl={handlers.onSetDependedIssueUrl}
          />
          <ConsoleDangerousActions
            onDeleteAllComments={handlers.onDeleteAllComments}
            onDeleteStory={handlers.onDeleteStory}
            storyNameForDeletion={storyNameForDeletion}
          />
        </div>
        <ConsoleCloseActions onClose={handlers.onClose} />
      </div>
    </div>
  );
};
