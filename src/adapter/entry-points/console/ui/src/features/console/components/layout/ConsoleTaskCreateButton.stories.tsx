import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleStoryEntry } from '../../logic/types';
import { ConsoleTaskCreateButton } from './ConsoleTaskCreateButton';

const storyEntries: ConsoleStoryEntry[] = [
  {
    storyName: 'regular / workflow improvement',
    storyOptionId: 'opt-workflow-improvement',
    color: 'BLUE',
    openItemCount: 3,
    storyViewUrl:
      'https://github.com/users/HiromiShikata/projects/48/views/1?filterQuery=story%3A%22regular+%2F+workflow+improvement%22',
    items: [],
  },
  {
    storyName: 'regular / tdpm dashboard & console improvement',
    storyOptionId: 'opt-tdpm-console',
    color: 'GREEN',
    openItemCount: 5,
    storyViewUrl:
      'https://github.com/users/HiromiShikata/projects/48/views/1?filterQuery=story%3A%22regular+%2F+tdpm+dashboard+%26+console+improvement%22',
    items: [],
  },
  {
    storyName: 'regular / infrastructure maintenance',
    storyOptionId: 'opt-infra',
    color: 'YELLOW',
    openItemCount: 1,
    storyViewUrl: null,
    items: [],
  },
];

const meta: Meta<typeof ConsoleTaskCreateButton> = {
  title: 'Console/ConsoleTaskCreateButton',
  component: ConsoleTaskCreateButton,
  args: {
    pjcode: 'umino',
    storyEntries,
    defaultNameWithOwner:
      'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    onCreateIssue: async (_storyOptionId: string, _title: string) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    },
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleTaskCreateButton>;

export const Default: Story = {};

export const NoRepository: Story = {
  args: {
    defaultNameWithOwner: null,
  },
};

export const NoStories: Story = {
  args: {
    storyEntries: [],
  },
};
