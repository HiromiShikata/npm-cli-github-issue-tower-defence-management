import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryList } from './ConsoleStoryList';

const sampleItems = [
  {
    number: 101,
    title: 'Set up CI pipeline',
    url: 'https://github.com/HiromiShikata/secretary/issues/101',
    repo: 'HiromiShikata/secretary',
    nameWithOwner: 'HiromiShikata/secretary',
    projectItemId: 'item-101',
    itemId: 'item-101',
    isPr: false,
    story: 'TDPM Console port',
    status: 'Todo by agent',
    agent: 'developer',
    nextActionDate: '2026-09-10T00:00:00.000Z',
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
    projectItemId: 'item-102',
    itemId: 'item-102',
    isPr: false,
    story: 'TDPM Console port',
    status: 'Awaiting Workspace',
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
    openItemCount: 12,
    storyViewUrl: null,
    items: sampleItems,
  },
  {
    storyName: 'Publish product documentation site',
    storyOptionId: 'f7cd5cbc',
    color: 'GREEN' as const,
    openItemCount: 3,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'Move to Okinawa',
    storyOptionId: '564803ee',
    color: 'PURPLE' as const,
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'regular / regular payment invoice tax',
    storyOptionId: 'd7cdcb61',
    color: 'YELLOW' as const,
    openItemCount: 7,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'regular / WORKFLOW BLOCKER',
    storyOptionId: 'e35b3da2',
    color: 'RED' as const,
    openItemCount: 2,
    storyViewUrl: null,
    items: [],
  },
];

const BASE_VIEW_URL =
  'https://github.com/orgs/HiromiShikata/projects/6/views/1';

const storiesWithUrl = storiesWithoutUrl.map((s) => ({
  ...s,
  storyViewUrl: `${BASE_VIEW_URL}?sliceBy%5Bvalue%5D=${encodeURI(s.storyName).replace(/#/g, '%23').replace(/&/g, '%26')}`,
}));

const storiesWithArchived = [
  ...storiesWithoutUrl,
  {
    storyName: 'regular / NO STORY; SET STORY FIELD',
    storyOptionId: '28415d6c',
    color: 'GRAY' as const,
    openItemCount: 5,
    storyViewUrl: null,
    items: [],
  },
];

const meta: Meta<typeof ConsoleStoryList> = {
  title: 'Console/ConsoleStoryList',
  component: ConsoleStoryList,
  args: {
    showGray: false,
    onCreateIssue: () => Promise.resolve(),
    onAddStory: () => Promise.resolve(),
    onSelectColor: () => undefined,
    onToggleGray: () => undefined,
    onReorderStory: () => Promise.resolve(),
    onDeleteStory: () => Promise.resolve(),
    onRenameStory: () => Promise.resolve(),
    optimisticColors: {},
    colorChangeInFlight: null,
    colorErrors: {},
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
    stories: storiesWithUrl,
    isLoading: false,
    error: null,
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

export const WithArchivedHidden: Story = {
  args: {
    stories: storiesWithArchived,
    isLoading: false,
    error: null,
    showGray: false,
  },
};

export const WithArchivedShown: Story = {
  args: {
    stories: storiesWithArchived,
    isLoading: false,
    error: null,
    showGray: true,
  },
};
