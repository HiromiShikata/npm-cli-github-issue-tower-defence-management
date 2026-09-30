export const REGULAR_STORY_PREFIX = 'regular /';
export const NO_STORY_MARKER = 'NO STORY';
export const DISABLED_STORY_OPTION_COLOR = 'GRAY';
export const BACKLOG_MILESTONE_STORY_MARKER = 'milestone on Backlog';
export const STORY_ISSUE_LABEL_NAME = 'story';

const BACKLOG_TICKET_URL_PATTERN = /\.backlog\.(?:com|jp)\/view\//;

export const isStoryUnset = (story: string | null): boolean =>
  story === null ||
  story.trim() === '' ||
  story.toUpperCase().includes(NO_STORY_MARKER);

export const isRegularStory = (story: string): boolean =>
  story.startsWith(REGULAR_STORY_PREFIX);

export const hasBacklogTicketUrl = (text: string): boolean =>
  BACKLOG_TICKET_URL_PATTERN.test(text);

export const hasStoryIssueLabel = (labels: string[]): boolean =>
  labels.some((label) => label.toLowerCase() === STORY_ISSUE_LABEL_NAME);
