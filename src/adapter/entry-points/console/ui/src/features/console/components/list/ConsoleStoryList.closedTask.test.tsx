import { render } from '@testing-library/react';
import type { ConsoleListItem, ConsoleStoryEntry } from '../../logic/types';
import {
  ConsoleStoryList,
  type ConsoleStoryListProps,
} from './ConsoleStoryList';

const closedItem: ConsoleListItem = {
  number: 12345,
  title: 'Example task for closed-state story',
  url: 'https://github.com/example/repository/issues/12345',
  repo: 'example/repository',
  nameWithOwner: 'example/repository',
  projectItemId: 'item-1',
  itemId: 'item-1',
  isPr: false,
  story: 'regular / NO STORY',
  status: 'In Tmux by human',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  relatedOpenPullRequestUrls: [],
  isClosed: true,
} as ConsoleListItem;

const stories: ConsoleStoryEntry[] = [
  {
    storyName: 'regular / NO STORY',
    storyOptionId: 'story-1',
    color: 'BLUE',
    description: '',
    openItemCount: 54,
    storyViewUrl: null,
    items: [closedItem],
  },
];

const props: ConsoleStoryListProps = {
  stories,
  isLoading: false,
  error: null,
  showArchived: false,
  showDone: false,
  onCreateIssue: () => Promise.resolve(),
  onAddStory: () => Promise.resolve(),
  onSelectColor: () => undefined,
  onToggleArchived: () => undefined,
  onToggleDone: () => undefined,
  onReorderStory: () => Promise.resolve(),
  onDeleteStory: () => Promise.resolve(),
  onRenameStory: () => Promise.resolve(),
  onUpdateDescription: () => Promise.resolve(),
  optimisticColors: {},
  colorChangeInFlight: null,
  colorErrors: {},
  onOpenItem: () => undefined,
  statusOptionNames: ['In Tmux by human', 'Done'],
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

describe('ConsoleStoryList closed task filtering', () => {
  it.each([
    { showDone: false, expected: false },
    { showDone: true, expected: true },
  ])(
    'renders a closed task according to the Done switch',
    ({ showDone, expected }) => {
      const { queryByText } = render(
        <ConsoleStoryList {...props} showDone={showDone} />,
      );
      expect(queryByText(closedItem.title) !== null).toBe(expected);
    },
  );
});
