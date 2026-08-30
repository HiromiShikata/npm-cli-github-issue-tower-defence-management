import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildConsoleListRows } from '../../logic/grouping';
import {
  consoleAgentOptionsFixture,
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
} from '../../testing/fixtures';
import { ConsoleQueuedList } from './ConsoleQueuedList';

const queuedItems = consoleListItemsFixture.filter(
  (item) =>
    (item.status === 'Awaiting Workspace' || item.status === 'Preparation') &&
    item.dependedIssueUrls.length === 0,
);

const meta: Meta<typeof ConsoleQueuedList> = {
  title: 'Console/ConsoleQueuedList',
  component: ConsoleQueuedList,
  args: {
    storyColors: consoleStoryColorsFixture,
    statusOptions: consoleStatusOptionsFixture,
    agentOptions: consoleAgentOptionsFixture,
    activeItemId: null,
    isLoading: false,
    error: null,
    onSelectItem: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleQueuedList>;

export const WithQueuedItems: Story = {
  args: {
    rows: buildConsoleListRows(queuedItems, {}, []),
  },
};

export const WithStoryGroups: Story = {
  args: {
    rows: buildConsoleListRows(
      queuedItems,
      {},
      Object.keys(consoleStoryColorsFixture),
    ),
  },
};

export const Loading: Story = {
  args: {
    rows: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    rows: [],
  },
};

export const ErrorState: Story = {
  args: {
    rows: [],
    error: 'HTTP 404',
  },
};
