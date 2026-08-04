import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleComment } from '../../logic/types';
import { ConsoleCommentComposer } from './ConsoleCommentComposer';

const acceptComment = async (body: string): Promise<ConsoleComment> => ({
  author: 'HiromiShikata',
  body,
  createdAt: '2026-06-19T11:58:00.000Z',
});

const meta: Meta<typeof ConsoleCommentComposer> = {
  title: 'Console/ConsoleCommentComposer',
  component: ConsoleCommentComposer,
  args: {
    now: Date.parse('2026-06-19T12:00:00.000Z'),
    onSubmit: acceptComment,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleCommentComposer>;

export const IssueComposerOpen: Story = {
  args: { isPr: false },
};

export const PullRequestComposerCollapsed: Story = {
  args: { isPr: true },
};

export const IssueComposerWithFileUpload: Story = {
  args: {
    isPr: false,
    relatedOpenPullRequestUrls: [],
    onUploadFile: async (file: File) =>
      `![${file.name}](https://github.com/user-attachments/assets/9f0b1c3d-4e5f-4a6b-8c7d-1e2f3a4b5c6d)`,
  },
};

export const IssueComposerUploadFailure: Story = {
  args: {
    isPr: false,
    relatedOpenPullRequestUrls: [],
    onUploadFile: async () => {
      throw new Error('No GitHub web session is available');
    },
  },
};
