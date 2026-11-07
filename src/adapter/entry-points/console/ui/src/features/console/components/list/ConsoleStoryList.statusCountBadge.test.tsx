import { render } from '@testing-library/react';
import type { ConsoleListItem, ConsoleStoryEntry } from '../../logic/types';
import {
  ConsoleStoryList,
  type ConsoleStoryListProps,
} from './ConsoleStoryList';

const makeItem = (number: number, status: string | null): ConsoleListItem => ({
  number,
  title: `Task ${number}`,
  url: `https://github.com/demo/repo/issues/${number}`,
  repo: 'demo/repo',
  nameWithOwner: 'demo/repo',
  projectItemId: `item-${number}`,
  itemId: `item-${number}`,
  isPr: false,
  story: 'Story One',
  status,
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-13T08:18:45.000Z',
  relatedOpenPullRequestUrls: [],
});

const stories: ConsoleStoryEntry[] = [
  {
    storyName: 'Story One',
    storyOptionId: 'story-one',
    color: 'BLUE',
    description: '',
    openItemCount: 3,
    storyViewUrl: null,
    items: [
      makeItem(1, 'Awaiting Owner'),
      makeItem(2, 'Preparation'),
      makeItem(3, 'Preparation'),
      makeItem(4, 'Done'),
    ],
  },
  {
    storyName: 'Story Two',
    storyOptionId: 'story-two',
    color: 'PURPLE',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [makeItem(5, 'Preparation')],
  },
];

const statusOptionNames = ['Awaiting Owner', 'Preparation', 'Done', 'Icebox'];

const baseProps: ConsoleStoryListProps = {
  stories,
  isLoading: false,
  error: null,
  showArchived: false,
  showDone: true,
  onCreateIssue: () => Promise.resolve(),
  onAddStory: () => Promise.resolve(),
  onSelectColor: () => undefined,
  onToggleArchived: () => undefined,
  onToggleDone: () => undefined,
  hideTriggered: false,
  hideEmptyStories: false,
  onToggleHideTriggered: () => undefined,
  onToggleHideEmptyStories: () => undefined,
  onReorderStory: () => Promise.resolve(),
  onDeleteStory: () => Promise.resolve(),
  onRenameStory: () => Promise.resolve(),
  onUpdateDescription: () => Promise.resolve(),
  optimisticColors: {},
  colorChangeInFlight: null,
  colorErrors: {},
  onOpenItem: () => undefined,
  statusOptionNames,
  onToggleStatus: () => undefined,
  onClearStatuses: () => undefined,
  agentOptions: [],
  statusFieldOptions: [],
  hiddenRowFields: [],
  onToggleRowField: () => undefined,
  taskActions: {
    onSetStory: () => Promise.resolve(),
    onSetAgent: () => Promise.resolve(),
    onSetStatus: () => Promise.resolve(),
    onSetDependedIssueUrl: () => Promise.resolve(),
    onSetNextActionDate: () => Promise.resolve(),
    onSetNextActionHour: () => Promise.resolve(),
  },
};

describe('ConsoleStoryList per-story count badge', () => {
  it.each([
    {
      label: 'no status is selected',
      selectedStatuses: [] as string[],
      expectedStoryOneBadge: '3',
    },
    {
      label: 'the selection holds only names that are not status options',
      selectedStatuses: ['Not A Status'],
      expectedStoryOneBadge: '3',
    },
    {
      label: 'one selected status matches one task',
      selectedStatuses: ['Awaiting Owner'],
      expectedStoryOneBadge: '1',
    },
    {
      label: 'two selected statuses count the tasks of either status',
      selectedStatuses: ['Awaiting Owner', 'Done'],
      expectedStoryOneBadge: '2',
    },
    {
      label: 'a selected status matching two tasks counts both',
      selectedStatuses: ['Preparation'],
      expectedStoryOneBadge: '2',
    },
  ])(
    'shows $expectedStoryOneBadge for Story One when $label',
    ({ selectedStatuses, expectedStoryOneBadge }) => {
      const { container } = render(
        <ConsoleStoryList {...baseProps} selectedStatuses={selectedStatuses} />,
      );
      const storyOneRow = Array.from(
        container.querySelectorAll<HTMLElement>('li.console-story-list-row'),
      ).find(
        (row) =>
          row.querySelector('.console-storytag')?.textContent === 'Story One',
      );
      expect(
        storyOneRow?.querySelector('.console-story-count')?.textContent,
      ).toBe(expectedStoryOneBadge);
    },
  );

  it('shows the matching task count on a story row listed under the selection', () => {
    const { container } = render(
      <ConsoleStoryList {...baseProps} selectedStatuses={['Preparation']} />,
    );
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>('li.console-story-list-row'),
    );
    expect(
      rows.map((row) => row.querySelector('.console-storytag')?.textContent),
    ).toEqual(['Story One', 'Story Two']);
    expect(
      rows.map((row) => row.querySelector('.console-story-count')?.textContent),
    ).toEqual(['2', '1']);
  });
});
