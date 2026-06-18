import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleListItemsFixture } from '../fixtures';
import { ConsoleListView } from './ConsoleListView';

const meta: Meta<typeof ConsoleListView> = {
  title: 'Console/ConsoleListView',
  component: ConsoleListView,
};

export default meta;

type Story = StoryObj<typeof ConsoleListView>;

export const WithItems: Story = {
  args: {
    items: consoleListItemsFixture,
    isLoading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    isLoading: true,
    error: null,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    isLoading: false,
    error: null,
  },
};

export const ErrorState: Story = {
  args: {
    items: [],
    isLoading: false,
    error: 'HTTP 404',
  },
};
