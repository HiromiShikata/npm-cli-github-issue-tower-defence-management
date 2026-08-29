import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
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
    onSubmit: acceptComment,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleCommentComposer>;

export const ComposerOpen: Story = {
  args: { initiallyOpen: true },
};

export const ComposerCollapsed: Story = {
  args: { initiallyOpen: false },
};

export const ComposerWithFileUpload: Story = {
  args: {
    initiallyOpen: true,
    onUploadFile: async (file: File) =>
      `![${file.name}](https://github.com/user-attachments/assets/9f0b1c3d-4e5f-4a6b-8c7d-1e2f3a4b5c6d)`,
  },
};

export const ComposerUploadFailure: Story = {
  args: {
    initiallyOpen: true,
    onUploadFile: async () => {
      throw new Error('No GitHub web session is available');
    },
  },
};

export const ComposerWithSavedDraft: Story = {
  args: {
    initiallyOpen: true,
    initialDraft: 'Previously typed text…',
  },
};

export const ComposerWithAwaitingWorkspaceButtons: Story = {
  args: {
    initiallyOpen: true,
    onOkAndAwaitingWorkspace: () => {},
    onCommentAndAwaitingWorkspace: () => {},
  },
};

export const ComposerAwaitingWorkspaceButtonsPosting: Story = {
  args: {
    initiallyOpen: true,
    onSubmit: () => new Promise<ConsoleComment>(() => {}),
    onOkAndAwaitingWorkspace: () => {},
    onCommentAndAwaitingWorkspace: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText('Leave a comment…'),
      'test comment',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Comment' }));
  },
};
