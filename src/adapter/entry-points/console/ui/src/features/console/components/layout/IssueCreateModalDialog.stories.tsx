import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleFieldOption, ConsoleStoryEntry } from '../../logic/types';
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

const agentOptions: ConsoleFieldOption[] = [
  { id: 'agent-developer', name: 'developer', color: 'BLUE' },
  { id: 'agent-chore', name: 'chore', color: 'GRAY' },
  { id: 'agent-triager', name: 'triager', color: 'GREEN' },
  { id: 'agent-pr-reviewer', name: 'pr-reviewer', color: 'PURPLE' },
];

const meta: Meta<typeof IssueCreateModalDialog> = {
  title: 'Console/IssueCreateModalDialog',
  component: IssueCreateModalDialog,
  args: {
    storyEntries,
    agentOptions,
    onSubmit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    },
    onClose: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof IssueCreateModalDialog>;

export const Default: Story = {};

export const NoAgentOptions: Story = {
  args: {
    agentOptions: [],
  },
};

export const SingleStory: Story = {
  args: {
    storyEntries: [storyEntries[0]],
  },
};

export const WithFleetTaskCreateUrl: Story = {
  args: {
    fleetTaskCreateUrl: 'https://github.com/HiromiShikata/secretary/issues/new',
  },
};

export const WithFileAttachments: Story = {
  play: async ({ canvasElement }) => {
    const { userEvent } = await import('storybook/test');
    const fileInput = canvasElement.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    if (fileInput === null) return;
    const imageFile = new File(['img'], 'screenshot.png', {
      type: 'image/png',
    });
    const docFile = new File(['doc'], 'notes.txt', { type: 'text/plain' });
    await userEvent.upload(fileInput, [imageFile, docFile]);
  },
};
