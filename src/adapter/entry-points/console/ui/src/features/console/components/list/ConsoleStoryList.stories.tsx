import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryList } from './ConsoleStoryList';

const stories = [
  {
    storyName: 'TDPM Console port',
    storyOptionId: '1491051e',
    color: 'BLUE' as const,
    openItemCount: 12,
  },
  {
    storyName: 'Publish product documentation site',
    storyOptionId: 'f7cd5cbc',
    color: 'GREEN' as const,
    openItemCount: 3,
  },
  {
    storyName: 'Move to Okinawa',
    storyOptionId: '564803ee',
    color: 'PURPLE' as const,
    openItemCount: 0,
  },
  {
    storyName: 'regular / regular payment invoice tax',
    storyOptionId: 'd7cdcb61',
    color: 'YELLOW' as const,
    openItemCount: 7,
  },
  {
    storyName: 'regular / WORKFLOW BLOCKER',
    storyOptionId: 'e35b3da2',
    color: 'RED' as const,
    openItemCount: 2,
  },
];

const meta: Meta<typeof ConsoleStoryList> = {
  title: 'Console/ConsoleStoryList',
  component: ConsoleStoryList,
  args: { onCreateIssue: () => Promise.resolve() },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryList>;

export const WithStories: Story = {
  args: {
    stories,
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
