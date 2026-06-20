import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildConsoleListRows } from '../../logic/grouping';
import {
  consoleListItemsFixture,
  consoleStoryColorsFixture,
} from '../../testing/fixtures';
import { ConsoleItemList } from './ConsoleItemList';

const meta: Meta<typeof ConsoleItemList> = {
  title: 'Console/ConsoleItemList',
  component: ConsoleItemList,
};

export default meta;

type Story = StoryObj<typeof ConsoleItemList>;

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
