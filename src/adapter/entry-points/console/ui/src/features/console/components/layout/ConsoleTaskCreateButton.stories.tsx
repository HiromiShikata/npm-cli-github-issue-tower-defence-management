import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleFieldOption, ConsoleStoryEntry } from '../../logic/types';
import {
  ConsoleTaskCreateButton,
  type IssueCreateParams,
} from './ConsoleTaskCreateButton';

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

const agentOptions: ConsoleFieldOption[] = [
  { id: 'agent-developer', name: 'developer', color: 'BLUE' },
  { id: 'agent-chore', name: 'chore', color: 'GRAY' },
  { id: 'agent-triager', name: 'triager', color: 'GREEN' },
  { id: 'agent-pr-reviewer', name: 'pr-reviewer', color: 'PURPLE' },
];

const meta: Meta<typeof ConsoleTaskCreateButton> = {
  title: 'Console/ConsoleTaskCreateButton',
  component: ConsoleTaskCreateButton,
  args: {
    pjcode: 'umino',
    storyEntries,
    agentOptions,
    defaultNameWithOwner:
      'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    onCreateIssue: async (_params: IssueCreateParams) => {
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
