import type {
  ConsoleCloseAction,
  ConsoleNextActionDateAction,
  ConsoleReviewAction,
} from './operations';
import type { ConsoleListItem, ConsoleTabName } from './types';

export type ConsoleToastColor =
  | 'green'
  | 'amber'
  | 'red'
  | 'gray'
  | 'blue'
  | 'error';

export type ConsoleActionKind =
  | { type: 'review'; action: ConsoleReviewAction }
  | { type: 'next_action_date'; action: ConsoleNextActionDateAction }
  | { type: 'set_story'; optionName: string }
  | { type: 'set_status'; optionName: string }
  | { type: 'set_in_tmux_by_human'; optionName: string }
  | { type: 'close'; action: ConsoleCloseAction };

export const ACTION_TOAST_DELAY_MS = 5000;

export const itemToastLabel = (item: ConsoleListItem): string =>
  `${item.isPr ? 'PR #' : '#'}${item.number}`;

export const actionToastMessage = (
  kind: ConsoleActionKind,
  tab: ConsoleTabName,
): string => {
  switch (kind.type) {
    case 'review':
      if (kind.action === 'approve') {
        return 'Approved';
      }
      if (kind.action === 'request_changes') {
        return 'Rejected';
      }
      if (kind.action === 'totally_wrong') {
        return 'Marked totally wrong';
      }
      return 'Marked unnecessary';
    case 'next_action_date':
      if (kind.action === 'snooze_1day') {
        return 'Next Action Date +1 day';
      }
      return tab === 'todo-by-human'
        ? 'Next Action Date +1 week and skip'
        : 'Next Action Date +1 week';
    case 'set_story':
      return `Story → ${kind.optionName}`;
    case 'set_status':
      return `Status → ${kind.optionName}`;
    case 'set_in_tmux_by_human':
      return 'Added to In Tmux by human';
    case 'close':
      return kind.action === 'close' ? 'Closed' : 'Closed as not planned';
  }
};

export const actionToastColor = (
  kind: ConsoleActionKind,
): ConsoleToastColor => {
  switch (kind.type) {
    case 'review':
      if (kind.action === 'approve') {
        return 'green';
      }
      if (kind.action === 'request_changes') {
        return 'amber';
      }
      if (kind.action === 'totally_wrong') {
        return 'red';
      }
      return 'gray';
    case 'next_action_date':
      return 'amber';
    case 'set_story':
    case 'set_status':
    case 'set_in_tmux_by_human':
      return 'blue';
    case 'close':
      return 'red';
  }
};

export const actionAdvances = (
  kind: ConsoleActionKind,
  tab: ConsoleTabName,
): boolean => {
  if (kind.type === 'next_action_date') {
    return tab === 'todo-by-human';
  }
  return true;
};

export const formatActionToast = (
  kind: ConsoleActionKind,
  item: ConsoleListItem,
  tab: ConsoleTabName,
): string => `${actionToastMessage(kind, tab)} — ${itemToastLabel(item)}`;
