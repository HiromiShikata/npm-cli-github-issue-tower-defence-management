import { type ConsoleOperationHandlers, isTodoByHumanTab } from '../operations';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleTabName,
} from '../types';
import { ConsoleCloseButtonGroup } from './ConsoleCloseButtonGroup';
import { ConsoleNextActionDateGroup } from './ConsoleNextActionDateGroup';
import { ConsolePullRequestReviewGroup } from './ConsolePullRequestReviewGroup';
import { ConsoleStatusButtonGroup } from './ConsoleStatusButtonGroup';
import { ConsoleStoryButtonGroup } from './ConsoleStoryButtonGroup';

export type ConsoleOperationBarProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  hasPullRequest: boolean;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  handlers: ConsoleOperationHandlers;
};

export const ConsoleOperationBar = ({
  tab,
  item,
  hasPullRequest,
  statusOptions,
  storyOptions,
  handlers,
}: ConsoleOperationBarProps) => {
  const showStory = tab === 'triage';
  const showClose = !item.isPr;
  return (
    <div className="console-operation-bar">
      {hasPullRequest && (
        <ConsolePullRequestReviewGroup onReview={handlers.onReview} />
      )}
      <ConsoleNextActionDateGroup
        isTodoByHuman={isTodoByHumanTab(tab)}
        onSetNextActionDate={handlers.onSetNextActionDate}
      />
      {showStory && (
        <ConsoleStoryButtonGroup
          storyOptions={storyOptions}
          onSetStory={handlers.onSetStory}
        />
      )}
      <ConsoleStatusButtonGroup
        statusOptions={statusOptions}
        onSetStatus={handlers.onSetStatus}
        onSetInTmuxByHuman={handlers.onSetInTmuxByHuman}
      />
      {showClose && <ConsoleCloseButtonGroup onClose={handlers.onClose} />}
    </div>
  );
};
