import type { ConsoleFieldOption, ConsoleTabName } from './types';

export const TOTALLY_WRONG_COMMENT_BODY = 'totally wrong';
export const UNNECESSARY_COMMENT_BODY = 'This pull request is unnecessary.';

export type ConsoleReviewAction =
  | 'approve'
  | 'request_changes'
  | 'unnecessary'
  | 'totally_wrong';

export type ConsoleNextActionDateAction = 'snooze_1day' | 'snooze_1week';

export type ConsoleCloseAction = 'close' | 'close_not_planned';

export type ConsoleOperationHandlers = {
  onReview: (action: ConsoleReviewAction) => void;
  onSetNextActionDate: (action: ConsoleNextActionDateAction) => void;
  onSetStory: (option: ConsoleFieldOption) => void;
  onSetStatus: (option: ConsoleFieldOption) => void;
  onSetInTmuxByHuman: (option: ConsoleFieldOption) => void;
  onClose: (action: ConsoleCloseAction) => void;
};

export const STATUS_BUTTON_NAMES: string[] = [
  'In Tmux by agent',
  'In Tmux by human',
  'Todo by human',
  'Awaiting Workspace',
];

export const IN_TMUX_BY_HUMAN_NAME = 'In Tmux by human';

export const isTodoByHumanTab = (tab: ConsoleTabName): boolean =>
  tab === 'todo-by-human';
