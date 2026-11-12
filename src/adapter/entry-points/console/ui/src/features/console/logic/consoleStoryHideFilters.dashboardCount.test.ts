import type { Issue } from '../../../../../../../../domain/entities/Issue';
import { GenerateDashboardRowUseCase } from '../../../../../../../../domain/usecases/dashboard/GenerateDashboardRowUseCase';
import { buildConsoleStoryRenderEntries } from './consoleStoryHideFilters';
import type { ConsoleColor, ConsoleListItem, ConsoleStoryEntry } from './types';

const ASSIGNEE = 'HiromiShikata';
const DEPENDED_ISSUE_URL = 'https://github.com/demo/repo/issues/999';
const NEXT_ACTION_DATE = new Date('2026-07-01T00:00:00.000Z');

const STORY_OPTIONS: {
  storyOptionId: string;
  storyName: string;
  color: ConsoleColor;
}[] = [
  { storyOptionId: 'opt-red-a', storyName: 'Red A', color: 'RED' },
  { storyOptionId: 'opt-red-b', storyName: 'Red B', color: 'RED' },
  { storyOptionId: 'opt-yellow', storyName: 'Yellow', color: 'YELLOW' },
  { storyOptionId: 'opt-blue', storyName: 'Blue', color: 'BLUE' },
  { storyOptionId: 'opt-green', storyName: 'Green', color: 'GREEN' },
];

const storyNameFor = (storyOptionId: string | null): string | null =>
  STORY_OPTIONS.find((option) => option.storyOptionId === storyOptionId)
    ?.storyName ?? null;

const fixtureIssue = (
  number: number,
  storyOptionId: string | null,
  overrides: Partial<Issue>,
): Issue => ({
  nameWithOwner: 'demo/repo',
  number,
  title: `Issue ${number}`,
  state: 'OPEN',
  status: null,
  story: storyNameFor(storyOptionId),
  storyOptionId,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: `https://github.com/demo/repo/issues/${number}`,
  assignees: [ASSIGNEE],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: '',
  itemId: `item-${number}`,
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-06-13T08:18:45.000Z'),
  author: 'someone',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const toStoryListItem = (issue: Issue): ConsoleListItem => ({
  number: issue.number,
  title: issue.title,
  url: issue.url,
  repo: issue.repo,
  nameWithOwner: issue.nameWithOwner,
  projectItemId: issue.itemId,
  itemId: issue.itemId,
  isPr: issue.isPr,
  story: storyNameFor(issue.storyOptionId ?? null) ?? '',
  storyOptionId: issue.storyOptionId ?? null,
  status: issue.status,
  agent: issue.agent,
  agentOptionId: issue.agentOptionId ?? null,
  nextActionDate: issue.nextActionDate?.toISOString() ?? null,
  nextActionHour: issue.nextActionHour,
  dependedIssueUrls: issue.dependedIssueUrls,
  labels: issue.labels,
  createdAt: issue.createdAt.toISOString(),
  relatedOpenPullRequestUrls: [],
  isClosed: issue.isClosed,
});

const issues: Issue[] = [
  fixtureIssue(1, 'opt-red-a', { status: 'Todo by human' }),
  fixtureIssue(2, 'opt-red-a', { status: 'Awaiting Owner' }),
  fixtureIssue(3, 'opt-red-a', { status: null }),
  fixtureIssue(4, 'opt-red-a', { status: 'Done' }),
  fixtureIssue(5, 'opt-red-a', {
    status: 'Awaiting Workspace',
    dependedIssueUrls: [DEPENDED_ISSUE_URL],
  }),
  fixtureIssue(6, 'opt-red-a', {
    status: 'Preparation',
    nextActionDate: NEXT_ACTION_DATE,
  }),
  fixtureIssue(7, 'opt-red-a', {
    status: 'Awaiting Owner',
    isClosed: true,
    state: 'CLOSED',
  }),
  fixtureIssue(8, 'opt-red-b', { status: 'Failed Preparation' }),
  fixtureIssue(9, 'opt-red-b', { status: 'Todo by human', nextActionHour: 9 }),
  fixtureIssue(10, 'opt-red-b', {
    status: 'Todo by human',
    assignees: ['someone-else'],
  }),
  fixtureIssue(11, 'opt-yellow', { status: 'Awaiting Owner' }),
  fixtureIssue(12, 'opt-yellow', { status: 'In Tmux by human' }),
  fixtureIssue(13, 'opt-yellow', {
    status: 'Todo by human',
    dependedIssueUrls: [DEPENDED_ISSUE_URL],
  }),
  fixtureIssue(14, 'opt-yellow', { status: 'Awaiting Workspace' }),
  fixtureIssue(15, 'opt-yellow', {
    status: 'Preparation',
    nextActionDate: NEXT_ACTION_DATE,
  }),
  fixtureIssue(16, 'opt-blue', { status: 'Todo by human' }),
  fixtureIssue(17, 'opt-blue', {
    status: 'Awaiting Owner',
    dependedIssueUrls: [DEPENDED_ISSUE_URL],
  }),
  fixtureIssue(18, 'opt-green', { status: 'Awaiting Owner' }),
  fixtureIssue(19, null, { status: 'Awaiting Owner' }),
];

const stories: ConsoleStoryEntry[] = STORY_OPTIONS.map((option) => {
  const items = issues
    .filter((issue) => issue.storyOptionId === option.storyOptionId)
    .map(toStoryListItem);
  return {
    storyName: option.storyName,
    storyOptionId: option.storyOptionId,
    color: option.color,
    description: '',
    openItemCount: items.filter((item) => item.isClosed !== true).length,
    storyViewUrl: null,
    items,
  };
});

const storyColorMap = new Map(
  STORY_OPTIONS.map((option) => [option.storyOptionId, option.color]),
);

const storyBadgeSumForColor = (color: ConsoleColor): number =>
  buildConsoleStoryRenderEntries({
    stories,
    effectiveStatusSelection: [],
    showDone: false,
    hideTriggered: true,
    hideEmptyStories: false,
  })
    .filter((renderEntry) => renderEntry.entry.color === color)
    .reduce((sum, renderEntry) => sum + renderEntry.badgeCount, 0);

describe('dashboard red and yellow counts against the Story tab badge', () => {
  it('equals the Story tab badge sums for the same fixture', () => {
    const dashboardRow = new GenerateDashboardRowUseCase().run({
      issues,
      assigneeLogin: ASSIGNEE,
      storyColorMap,
    });

    expect(dashboardRow.humanPendingRed).toBe(storyBadgeSumForColor('RED'));
    expect(dashboardRow.humanPendingYellow).toBe(
      storyBadgeSumForColor('YELLOW'),
    );
    expect(dashboardRow.humanPendingRed).toBe(5);
    expect(dashboardRow.humanPendingYellow).toBe(3);
  });
});
