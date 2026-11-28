import type {
  ConsoleCloseAction,
  ConsoleNextActionDateAction,
  ConsoleReviewAction,
} from './operations';

export type ConsoleActionButtonLabel =
  | ConsoleCloseAction
  | ConsoleNextActionDateAction
  | ConsoleReviewAction;

export const consoleActionButtonLabels: Record<
  ConsoleActionButtonLabel,
  string
> = {
  snooze_1hour: '+1時間',
  snooze_3hours: '+3時間',
  snooze_6hours: '+6時間',
  snooze_1day: '+1日',
  snooze_2days: '+2日',
  snooze_3days: '+3日',
  snooze_5days: '+5日',
  snooze_1week: '+1週',
  snooze_1month: '+1か月',
  approve_and_merge: 'Approve & Merge',
  request_changes: 'Request Changes',
  totally_wrong: 'Totally Wrong',
  unnecessary: 'Unnecessary',
  close: 'Close',
  close_not_planned: 'Close as not planned',
};
