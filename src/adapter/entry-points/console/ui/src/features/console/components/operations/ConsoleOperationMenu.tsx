import {
  type ConsoleOperationHandlers,
  isTodoByHumanTab,
} from '../../logic/operations';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleTabName,
} from '../../logic/types';
import { ConsoleCloseActions } from './ConsoleCloseActions';
import { ConsoleNextActionDateActions } from './ConsoleNextActionDateActions';
import { ConsolePullRequestReviewActions } from './ConsolePullRequestReviewActions';
import { ConsoleStatusActions } from './ConsoleStatusActions';
import { ConsoleStoryActions } from './ConsoleStoryActions';

export type ConsoleOperationBarProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  hasPullRequest: boolean;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  handlers: ConsoleOperationHandlers;
};

export const ConsoleOperationMenu = ({
  tab,
  hasPullRequest,
  statusOptions,
  storyOptions,
  handlers,
}: ConsoleOperationBarProps) => {
  const showStory = tab === 'triage';
  return (
    <div className="console-operation-bar">
      {hasPullRequest && (
        <ConsolePullRequestReviewActions onReview={handlers.onReview} />
      )}
      <ConsoleNextActionDateActions
        isTodoByHuman={isTodoByHumanTab(tab)}
        onSetNextActionDate={handlers.onSetNextActionDate}
      />
      {showStory && (
        <ConsoleStoryActions
          storyOptions={storyOptions}
          onSetStory={handlers.onSetStory}
        />
      )}
      <ConsoleStatusActions
        statusOptions={statusOptions}
        onSetStatus={handlers.onSetStatus}
        onSetInTmuxByHuman={handlers.onSetInTmuxByHuman}
      />
      <ConsoleCloseActions onClose={handlers.onClose} />
    </div>
  );
};
