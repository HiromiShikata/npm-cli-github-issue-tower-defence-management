import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { ConsoleStoryList } from './ConsoleStoryList';

const sampleItems = [
  {
    number: 101,
    title: 'Set up CI pipeline',
    url: 'https://github.com/HiromiShikata/secretary/issues/101',
    repo: 'HiromiShikata/secretary',
    nameWithOwner: 'HiromiShikata/secretary',
    projectItemId: 'PVTI_lAHOAGJHa84AFWnrzgSb101',
    itemId: 'PVTI_lAHOAGJHa84AFWnrzgSb101',
    isPr: false,
    story: 'TDPM Console port',
    status: 'Awaiting Owner',
    agent: 'developer',
    nextActionDate: '2026-09-10',
    nextActionHour: 10,
    dependedIssueUrls: ['https://github.com/HiromiShikata/secretary/issues/55'],
    labels: [],
    createdAt: '2026-08-01T08:00:00.000Z',
    relatedOpenPullRequestUrls: [],
  },
  {
    number: 102,
    title: 'Write release notes',
    url: 'https://github.com/HiromiShikata/secretary/issues/102',
    repo: 'HiromiShikata/secretary',
    nameWithOwner: 'HiromiShikata/secretary',
    projectItemId: 'PVTI_lAHOAGJHa84AFWnrzgSb102',
    itemId: 'PVTI_lAHOAGJHa84AFWnrzgSb102',
    isPr: false,
    story: 'TDPM Console port',
    status: 'Awaiting Owner',
    agent: null,
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [],
    labels: [],
    createdAt: '2026-08-02T08:00:00.000Z',
    relatedOpenPullRequestUrls: [],
  },
];

const storiesWithoutUrl = [
  {
    storyName: 'TDPM Console port',
    storyOptionId: '1491051e',
    color: 'BLUE' as const,
    description: 'Rebuild the TDPM console UI with new story tab features.',
    openItemCount: 12,
    storyViewUrl: null,
    items: sampleItems,
  },
  {
    storyName: 'Publish product documentation site',
    storyOptionId: 'f7cd5cbc',
    color: 'GREEN' as const,
    description: '',
    openItemCount: 3,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'Move to Okinawa',
    storyOptionId: '564803ee',
    color: 'PURPLE' as const,
    description: 'Personal relocation project.',
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'regular / regular payment invoice tax',
    storyOptionId: 'd7cdcb61',
    color: 'YELLOW' as const,
    description: '',
    openItemCount: 7,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'regular / WORKFLOW BLOCKER',
    storyOptionId: 'e35b3da2',
    color: 'RED' as const,
    description: '',
    openItemCount: 2,
    storyViewUrl: null,
    items: [],
  },
];

const storiesWithArchived = [
  ...storiesWithoutUrl,
  {
    storyName: 'regular / NO STORY; SET STORY FIELD',
    storyOptionId: '28415d6c',
    color: 'GRAY' as const,
    description: '',
    openItemCount: 5,
    storyViewUrl: null,
    items: [],
  },
];

const completedStoryEntry = {
  storyName: 'Ship v1 release',
  storyOptionId: 'a3f91c02',
  color: 'BLUE' as const,
  description: '',
  openItemCount: 1,
  storyViewUrl: null,
  items: [
    {
      number: 201,
      title: 'Finalize release notes',
      url: 'https://github.com/HiromiShikata/secretary/issues/201',
      repo: 'HiromiShikata/secretary',
      nameWithOwner: 'HiromiShikata/secretary',
      projectItemId: 'PVTI_lAHOAGJHa84AFWnrzgSb201',
      itemId: 'PVTI_lAHOAGJHa84AFWnrzgSb201',
      isPr: false,
      story: 'Ship v1 release',
      status: 'Done',
      agent: null,
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
      labels: [],
      createdAt: '2026-05-01T08:00:00.000Z',
      relatedOpenPullRequestUrls: [],
    },
  ],
};

const storiesWithArchivedAndDone = [
  ...storiesWithArchived,
  completedStoryEntry,
];

const meta: Meta<typeof ConsoleStoryList> = {
  title: 'Console/ConsoleStoryList',
  component: ConsoleStoryList,
  args: {
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
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryList>;

export const WithStories: Story = {
  args: {
    stories: storiesWithoutUrl,
    isLoading: false,
    error: null,
  },
};

export const WithStoriesLinked: Story = {
  args: {
    stories: storiesWithoutUrl,
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstStoryBadge] = canvas.getAllByRole('button', {
      name: 'TDPM Console port',
    });
    await userEvent.click(firstStoryBadge);
  },
};

export const Loading: Story = {
  args: {
    stories: [],
    isLoading: true,
    error: null,
  },
};

export const Empty: Story = {
  args: {
    stories: [],
    isLoading: false,
    error: null,
  },
};

export const ErrorState: Story = {
  args: {
    stories: [],
    isLoading: false,
    error: 'HTTP 404',
  },
};

export const VisibilityControlsBothHidden: Story = {
  args: {
    stories: storiesWithArchivedAndDone,
    isLoading: false,
    error: null,
    showArchived: false,
    showDone: false,
  },
};

export const VisibilityControlsArchivedShown: Story = {
  args: {
    stories: storiesWithArchivedAndDone,
    isLoading: false,
    error: null,
    showArchived: true,
    showDone: false,
  },
};

export const VisibilityControlsDoneShown: Story = {
  args: {
    stories: storiesWithArchivedAndDone,
    isLoading: false,
    error: null,
    showArchived: false,
    showDone: true,
  },
};

export const VisibilityControlsBothShown: Story = {
  args: {
    stories: storiesWithArchivedAndDone,
    isLoading: false,
    error: null,
    showArchived: true,
    showDone: true,
  },
};

export const VisibilityControlsDoneHiddenWithAwaitingWorkspaceOnlyStory: Story =
  {
    args: {
      stories: [
        ...storiesWithoutUrl,
        {
          storyName: 'Automate console deployment',
          storyOptionId: 'b62e4d17',
          color: 'ORANGE' as const,
          description: 'Deploy the TDPM console from GitHub Actions.',
          openItemCount: 1,
          storyViewUrl: null,
          items: [
            {
              number: 301,
              title: 'Add console deploy workflow',
              url: 'https://github.com/HiromiShikata/secretary/issues/301',
              repo: 'HiromiShikata/secretary',
              nameWithOwner: 'HiromiShikata/secretary',
              projectItemId: 'PVTI_lAHOAGJHa84AFWnrzgSb301',
              itemId: 'PVTI_lAHOAGJHa84AFWnrzgSb301',
              isPr: false,
              story: 'Automate console deployment',
              status: 'Awaiting Workspace',
              agent: 'developer',
              nextActionDate: null,
              nextActionHour: null,
              dependedIssueUrls: [],
              labels: [],
              createdAt: '2026-09-15T08:00:00.000Z',
              relatedOpenPullRequestUrls: [],
            },
          ],
        },
      ],
      isLoading: false,
      error: null,
      showArchived: false,
      showDone: false,
    },
  };

export const OverflowMenuOpen: Story = {
  args: {
    stories: storiesWithoutUrl,
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstOverflowBtn] = canvas.getAllByRole('button', {
      name: 'More options',
    });
    await userEvent.click(firstOverflowBtn);
  },
};

export const TasksExpanded: Story = {
  args: {
    stories: storiesWithoutUrl,
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstChevron] = canvas.getAllByRole('button', {
      name: 'Show tasks',
    });
    await userEvent.click(firstChevron);
  },
};

export const TasksExpandedWithDoneRowsHidden: Story = {
  args: {
    stories: [
      {
        storyName: 'Stories tab task visibility',
        storyOptionId: '6e0b5f3a',
        color: 'BLUE' as const,
        description: 'Keep Stories tab task rows in step with the Done switch.',
        openItemCount: 2,
        storyViewUrl: null,
        items: [
          {
            number: 3660,
            title: 'Hide Done task rows while the Done switch is off',
            url: 'https://github.com/demo/repo/issues/3660',
            repo: 'demo/repo',
            nameWithOwner:
              'demo/repo',
            projectItemId: 'PVTI_lAHOAGJHa84AFWnrzgSb3660',
            itemId: 'PVTI_lAHOAGJHa84AFWnrzgSb3660',
            isPr: false,
            story: 'Stories tab task visibility',
            status: 'Done',
            agent: 'developer',
            nextActionDate: null,
            nextActionHour: null,
            dependedIssueUrls: [],
            labels: [],
            createdAt: '2026-10-20T08:00:00.000Z',
            relatedOpenPullRequestUrls: [],
          },
          {
            number: 3661,
            title: 'Keep stories visible whatever their task statuses are',
            url: 'https://github.com/demo/repo/issues/3661',
            repo: 'demo/repo',
            nameWithOwner:
              'demo/repo',
            projectItemId: 'PVTI_lAHOAGJHa84AFWnrzgSb3661',
            itemId: 'PVTI_lAHOAGJHa84AFWnrzgSb3661',
            isPr: false,
            story: 'Stories tab task visibility',
            status: 'In Progress',
            agent: 'developer',
            nextActionDate: '2026-10-31',
            nextActionHour: 9,
            dependedIssueUrls: [
              'https://github.com/demo/repo/issues/3660',
            ],
            labels: [],
            createdAt: '2026-10-21T08:00:00.000Z',
            relatedOpenPullRequestUrls: [],
          },
          {
            number: 3662,
            title: 'Review Stories tab screenshots built from fixture data',
            url: 'https://github.com/demo/repo/issues/3662',
            repo: 'demo/repo',
            nameWithOwner:
              'demo/repo',
            projectItemId: 'PVTI_lAHOAGJHa84AFWnrzgSb3662',
            itemId: 'PVTI_lAHOAGJHa84AFWnrzgSb3662',
            isPr: false,
            story: 'Stories tab task visibility',
            status: 'Todo by human',
            agent: null,
            nextActionDate: null,
            nextActionHour: null,
            dependedIssueUrls: [],
            labels: [],
            createdAt: '2026-10-22T08:00:00.000Z',
            relatedOpenPullRequestUrls: [],
          },
        ],
      },
    ],
    isLoading: false,
    error: null,
    showArchived: false,
    showDone: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstChevron] = canvas.getAllByRole('button', {
      name: 'Show tasks',
    });
    await userEvent.click(firstChevron);
  },
};
