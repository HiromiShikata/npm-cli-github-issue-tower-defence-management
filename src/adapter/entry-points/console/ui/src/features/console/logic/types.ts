export type ConsoleColor =
  | 'GRAY'
  | 'BLUE'
  | 'GREEN'
  | 'YELLOW'
  | 'ORANGE'
  | 'RED'
  | 'PINK'
  | 'PURPLE';

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

export type ConsoleStoryColorSource = Record<
  string,
  ConsoleColor | { color: ConsoleColor }
>;

export type ConsoleIssueState = {
  state: string;
  merged: boolean;
  isPullRequest: boolean;
};

export type ConsoleComment = {
  author: string;
  body: string;
  createdAt: string;
};

export type ConsoleChangedFile = {
  path: string;
  additions: number;
  deletions: number;
  status: string;
  patch: string | null;
};

export type ConsoleCommit = {
  sha: string;
  message: string;
  author: string;
  authoredAt: string;
};

export type ConsoleRelatedPullRequest = {
  url: string;
  branchName: string | null;
  createdAt: string;
  isDraft: boolean;
  isConflicted: boolean;
  isPassedAllCiJob: boolean;
  isCiStateSuccess: boolean;
  isResolvedAllReviewComments: boolean;
  isBranchOutOfDate: boolean;
  missingRequiredCheckNames: string[];
  summary: {
    title: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  } | null;
};

export type ConsoleOverlayStatus = {
  name: string;
  color: ConsoleColor;
};

export type ConsoleOverlayStory = {
  name: string;
  color: ConsoleColor;
};

export type ConsoleOverlayEntry = {
  done?: boolean;
  status?: ConsoleOverlayStatus;
  story?: ConsoleOverlayStory;
  ts: number;
  mode: ConsoleTabName;
};

export type ConsoleOverlay = Record<string, ConsoleOverlayEntry>;

export type ConsoleTabName =
  | 'workflow-blocker'
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
  { name: 'workflow-blocker', label: 'Workflow Blocker' },
  { name: 'prs', label: 'Awaiting Quality Check' },
  { name: 'triage', label: 'Triage' },
  { name: 'unread', label: 'Unread' },
  { name: 'failed-preparation', label: 'Failed Preparation' },
  { name: 'todo-by-human', label: 'Todo by human' },
];
