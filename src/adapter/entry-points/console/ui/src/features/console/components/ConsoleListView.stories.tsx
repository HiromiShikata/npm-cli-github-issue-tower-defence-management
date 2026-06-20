import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleListItemsFixture,
  consoleStoryColorsFixture,
} from '../fixtures';
import { buildConsoleListRows } from '../grouping';
import { ConsoleListView } from './ConsoleListView';

const meta: Meta<typeof ConsoleListView> = {
  title: 'Console/ConsoleListView',
  component: ConsoleListView,
};

export default meta;

type Story = StoryObj<typeof ConsoleListView>;

export const WithStoryGroups: Story = {
  args: {
    rows: buildConsoleListRows(consoleListItemsFixture, {}),
    storyColors: consoleStoryColorsFixture,
    activeItemId: null,
    isLoading: false,
    error: null,
    onSelectItem: () => {},
  },
};

export const Loading: Story = {
  args: {
    rows: [],
    storyColors: {},
    activeItemId: null,
    isLoading: true,
    error: null,
    onSelectItem: () => {},
  },
};

export const Empty: Story = {
  args: {
    rows: [],
    storyColors: {},
    activeItemId: null,
    isLoading: false,
    error: null,
    onSelectItem: () => {},
  },
};

export const ErrorState: Story = {
  args: {
    rows: [],
    storyColors: {},
    activeItemId: null,
    isLoading: false,
    error: 'HTTP 404',
    onSelectItem: () => {},
  },
};
