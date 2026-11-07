import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { ConsoleStoryList } from './ConsoleStoryList';

const closedTask = {
  number: 54321,
  title: 'Example task for closed-state story',
  url: 'https://github.com/example/repository/issues/54321',
  repo: 'example/repository',
  nameWithOwner: 'example/repository',
  projectItemId: 'item-54321',
  itemId: 'item-54321',
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
};

const stories = [
  {
    storyName: 'regular / NO STORY',
    storyOptionId: 'story-54321',
    color: 'BLUE' as const,
    description: '',
    openItemCount: 54,
    storyViewUrl: null,
    items: [closedTask],
  },
];

const meta: Meta<typeof ConsoleStoryList> = {
  title: 'Console/ConsoleStoryList/ClosedTask',
  component: ConsoleStoryList,
  args: {
    stories,
    isLoading: false,
    error: null,
    showArchived: false,
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
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryList>;

const expandStoryTasks: NonNullable<Story['play']> = async ({
  canvasElement,
}) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Show tasks' }));
};

export const DoneSwitchOff: Story = {
  args: { showDone: false },
  play: expandStoryTasks,
};

export const DoneSwitchOn: Story = {
  args: { showDone: true },
  play: expandStoryTasks,
};
