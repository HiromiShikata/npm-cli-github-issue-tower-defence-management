import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleStoryEntry } from '../../logic/types';
import { IssueCreateModalDialog } from './IssueCreateModalDialog';

const storyEntries: ConsoleStoryEntry[] = [
  {
    storyName: 'regular / workflow improvement',
    storyOptionId: 'opt-workflow-improvement',
    color: 'BLUE',
    description: '',
    openItemCount: 3,
    storyViewUrl:
      'https://github.com/users/HiromiShikata/projects/48/views/1?filterQuery=story%3A%22regular+%2F+workflow+improvement%22',
    items: [],
  },
  {
    storyName: 'regular / tdpm dashboard & console improvement',
    storyOptionId: 'opt-tdpm-console',
    color: 'GREEN',
    description: '',
    openItemCount: 5,
    storyViewUrl:
      'https://github.com/users/HiromiShikata/projects/48/views/1?filterQuery=story%3A%22regular+%2F+tdpm+dashboard+%26+console+improvement%22',
    items: [],
  },
  {
    storyName: 'regular / infrastructure maintenance',
    storyOptionId: 'opt-infra',
    color: 'YELLOW',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [],
  },
];

const meta: Meta<typeof IssueCreateModalDialog> = {
  title: 'Console/IssueCreateModalDialog',
  component: IssueCreateModalDialog,
  args: {
    storyEntries,
    onSubmit: () => {},
    onClose: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof IssueCreateModalDialog>;

export const Default: Story = {};

export const SingleStory: Story = {
  args: {
    storyEntries: [storyEntries[0]],
  },
};
