import type {
  ConsoleCloseEvent,
  ConsoleFieldOption,
  ConsoleReviewEvent,
  ConsoleSnoozeEvent,
  ConsoleTabName,
} from '../types';
import { ConsoleCloseButtonGroup } from './ConsoleCloseButtonGroup';
import { ConsoleNextActionDateGroup } from './ConsoleNextActionDateGroup';
import { ConsolePullRequestReviewGroup } from './ConsolePullRequestReviewGroup';
import { ConsoleStatusButtonGroup } from './ConsoleStatusButtonGroup';
import { ConsoleStoryButtonGroup } from './ConsoleStoryButtonGroup';

export type ConsoleOperationBarProps = {
  tab: ConsoleTabName;
  isPr: boolean;
  hasReviewTarget: boolean;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  onReview: (event: ConsoleReviewEvent) => void;
  onSnooze: (event: ConsoleSnoozeEvent) => void;
  onSetStory: (option: ConsoleFieldOption) => void;
  onSetStatus: (option: ConsoleFieldOption) => void;
  onSetInTmux: (option: ConsoleFieldOption) => void;
  onClose: (event: ConsoleCloseEvent) => void;
};

export const ConsoleOperationBar = ({
  tab,
  isPr,
  hasReviewTarget,
  statusOptions,
  storyOptions,
  onReview,
  onSnooze,
  onSetStory,
  onSetStatus,
  onSetInTmux,
  onClose,
}: ConsoleOperationBarProps) => {
  const showReviewGroup = hasReviewTarget;
  const showStoryGroup = tab === 'triage';
  const showCloseGroup = !isPr;

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3">
      {showReviewGroup && <ConsolePullRequestReviewGroup onReview={onReview} />}
      <ConsoleNextActionDateGroup tab={tab} onSnooze={onSnooze} />
      {showStoryGroup && (
        <ConsoleStoryButtonGroup
          storyOptions={storyOptions}
          onSetStory={onSetStory}
        />
      )}
      <ConsoleStatusButtonGroup
        statusOptions={statusOptions}
        onSetStatus={onSetStatus}
        onSetInTmux={onSetInTmux}
      />
      {showCloseGroup && <ConsoleCloseButtonGroup onClose={onClose} />}
    </div>
  );
};
