import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleListItemsFixture, consoleStatusTabFixture } from '../fixtures';
import { ConsoleListView } from './ConsoleListView';

const meta: Meta<typeof ConsoleListView> = {
  title: 'Console/ConsoleListView',
  component: ConsoleListView,
};

export default meta;

type Story = StoryObj<typeof ConsoleListView>;

const storyColors = {
  'TDPM Console port': 'BLUE' as const,
  'regular / workflow improvement': 'GREEN' as const,
};

export const WithStoryGroups: Story = {
  args: {
    items: consoleListItemsFixture,
    storyColors,
    selectedItemId: null,
    onSelectItem: () => undefined,
    isLoading: false,
    error: null,
  },
};

export const WithSelectedItem: Story = {
  args: {
    items: consoleListItemsFixture,
    storyColors,
    selectedItemId: consoleStatusTabFixture.items[1].itemId,
    onSelectItem: () => undefined,
    isLoading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    storyColors,
    selectedItemId: null,
    onSelectItem: () => undefined,
    isLoading: true,
    error: null,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    storyColors,
    selectedItemId: null,
    onSelectItem: () => undefined,
    isLoading: false,
    error: null,
  },
};

export const ErrorState: Story = {
  args: {
    items: [],
    storyColors,
    selectedItemId: null,
    onSelectItem: () => undefined,
    isLoading: false,
    error: 'HTTP 404',
  },
};
