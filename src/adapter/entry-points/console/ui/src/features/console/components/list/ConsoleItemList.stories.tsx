import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildConsoleListRows } from '../../logic/grouping';
import type { ConsoleOverlay } from '../../logic/types';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
} from '../../testing/fixtures';
import { ConsoleItemList } from './ConsoleItemList';

const prsItems = consoleListItemsFixture.filter((item) => item.isPr);
const prsRows = buildConsoleListRows(prsItems, {}, []);
const prsExecutiveSummaries = Object.fromEntries(
  prsItems.map((item) => [
    item.projectItemId,
    'タスクのゴール: awaiting quality check 一覧に OK ボタンと executive summary を表示する\n実施内容: ConsoleItemList に props を追加し ConsolePage から渡すように実装\n残りの作業と判断: なし',
  ]),
);

const meta: Meta<typeof ConsoleItemList> = {
  title: 'Console/ConsoleItemList',
  component: ConsoleItemList,
  args: {
    now: Date.parse('2026-06-19T12:00:00.000Z'),
    statusOptions: consoleStatusOptionsFixture,
  },
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

export const PrsTabWithActions: Story = {
  args: {
    rows: prsRows,
    storyColors: consoleStoryColorsFixture,
    statusOptions: consoleStatusOptionsFixture,
    activeItemId: null,
    isLoading: false,
    error: null,
    onSelectItem: () => {},
    executiveSummaries: prsExecutiveSummaries,
    onOkAndAwaitingWorkspace: () => {},
  },
};
