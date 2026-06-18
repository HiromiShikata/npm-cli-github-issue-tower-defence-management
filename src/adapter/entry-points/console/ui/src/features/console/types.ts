export type ConsoleColor =
  | 'GRAY'
  | 'BLUE'
  | 'GREEN'
  | 'YELLOW'
  | 'ORANGE'
  | 'RED'
  | 'PINK'
  | 'PURPLE';

export type ConsoleItemState = 'open' | 'closed';

export type ConsoleItemStateReason = 'completed' | 'not_planned' | '';

export type ConsoleListItem = {
  number: number;
  title: string;
  url: string;
  repo: string;
  nameWithOwner: string;
  projectItemId: string;
  itemId: string;
  isPr: boolean;
  story: string;
  labels: string[];
  createdAt: string;
  state: ConsoleItemState;
  stateReason: ConsoleItemStateReason;
};

export type ConsoleFieldOption = {
  id: string;
  name: string;
  color: ConsoleColor;
};

export type ConsoleStatusTab = {
  pjcode: string;
  generatedAt: string;
  statusOptions: ConsoleFieldOption[];
  storyOrder: string[];
  storyColors: Record<string, { color: ConsoleColor }>;
  items: ConsoleListItem[];
};

export type ConsoleTriageTab = {
  pjcode: string;
  generatedAt: string;
  storyOptions: ConsoleFieldOption[];
  storyOrder: string[];
  storyColors: Record<string, ConsoleColor>;
  items: ConsoleListItem[];
};

export type ConsoleTabData = ConsoleStatusTab | ConsoleTriageTab;

export type ConsoleTabName =
  | 'prs'
  | 'triage'
  | 'unread'
  | 'failed-preparation'
  | 'todo-by-human';

export type ConsoleTab = {
  name: ConsoleTabName;
  label: string;
};

export const CONSOLE_TABS: ConsoleTab[] = [
  { name: 'prs', label: 'Awaiting Quality Check' },
  { name: 'triage', label: 'Triage' },
  { name: 'unread', label: 'Unread' },
  { name: 'failed-preparation', label: 'Failed Preparation' },
  { name: 'todo-by-human', label: 'Todo By Human' },
];

export type ConsoleItemIconKind =
  | 'prDraft'
  | 'prMerged'
  | 'prClosed'
  | 'prOpen'
  | 'issueClosedNotPlanned'
  | 'issueClosed'
  | 'issueOpen';

export type ConsoleComment = {
  author: string;
  body: string;
  createdAt: string;
};

export type ConsoleItemBody = {
  body: string;
  labels: string[];
  createdAt: string;
  comments: ConsoleComment[];
  state: ConsoleItemState;
  stateReason: ConsoleItemStateReason;
};

export type ConsolePullRequestFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
};

export type ConsolePullRequestCommit = {
  sha: string;
  message: string;
  author: string;
  authoredAt: string;
};

export type ConsolePullRequestDetail = {
  title: string;
  body: string;
  state: ConsoleItemState;
  merged: boolean;
  isDraft: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  headRefName: string;
  baseRefName: string;
  author: string;
  files: ConsolePullRequestFile[];
  commits: ConsolePullRequestCommit[];
};

export type ConsoleRelatedPullRequest = {
  url: string;
  repo: string;
  number: number;
  title: string;
  isDraft: boolean;
};

export type ConsoleReviewEvent =
  | 'APPROVE'
  | 'REQUEST_CHANGES'
  | 'CLOSE_UNNEEDED'
  | 'CLOSE_WRONG';

export type ConsoleStatusActionEvent = 'set_status' | 'set_intmux';

export type ConsoleCloseEvent = 'close' | 'close_not_planned';

export type ConsoleSnoozeEvent = 'snooze_1day' | 'snooze_1week';

export type ConsoleStoryEvent = 'set_story';

export type ConsoleOperationEvent =
  | ConsoleReviewEvent
  | ConsoleStatusActionEvent
  | ConsoleCloseEvent
  | ConsoleSnoozeEvent
  | ConsoleStoryEvent;

export type ConsoleReviewTarget = {
  repo: string;
  number: number;
};
