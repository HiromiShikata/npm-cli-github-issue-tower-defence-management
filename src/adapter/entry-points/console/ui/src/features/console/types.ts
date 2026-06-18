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
