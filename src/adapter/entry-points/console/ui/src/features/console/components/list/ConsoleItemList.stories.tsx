import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildConsoleListRows } from '../../logic/grouping';
import type { ConsoleOverlay } from '../../logic/types';
import {
  consoleListItemsFixture,
  consoleStoryColorsFixture,
} from '../../testing/fixtures';
import { ConsoleItemList } from './ConsoleItemList';

const meta: Meta<typeof ConsoleItemList> = {
  title: 'Console/ConsoleItemList',
  component: ConsoleItemList,
  args: { now: Date.parse('2026-06-19T12:00:00.000Z') },
};

export default meta;

type Story = StoryObj<typeof ConsoleItemList>;

export const WithStoryGroups: Story = {
  args: {
    rows: buildConsoleListRows(consoleListItemsFixture, {}, []),
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

const staleOverlay: ConsoleOverlay = {
  PVTI_lADOABCD1234zgABCD01: {
    ts: 100,
    mode: 'prs',
    story: { name: 'OldStory', color: 'GRAY' },
  },
};

export const StaleOverlayBefore: Story = {
  args: {
    rows: buildConsoleListRows([consoleListItemsFixture[0]], staleOverlay, []),
    storyColors: consoleStoryColorsFixture,
    activeItemId: null,
    isLoading: false,
    error: null,
    onSelectItem: () => {},
  },
};

export const StaleOverlayAfter: Story = {
  args: {
    rows: buildConsoleListRows(
      [consoleListItemsFixture[0]],
      staleOverlay,
      [],
      '2026-08-24T00:00:00Z',
    ),
    storyColors: consoleStoryColorsFixture,
    activeItemId: null,
    isLoading: false,
    error: null,
    onSelectItem: () => {},
  },
};
