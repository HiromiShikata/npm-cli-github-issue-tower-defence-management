import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleCommentsFixture } from '../../testing/fixtures';
import { ConsoleCommentList } from './ConsoleCommentList';

const meta: Meta<typeof ConsoleCommentList> = {
  title: 'Console/ConsoleCommentList',
  component: ConsoleCommentList,
  args: { now: Date.parse('2026-06-19T12:00:00.000Z') },
};

export default meta;

type Story = StoryObj<typeof ConsoleCommentList>;

export const WithComments: Story = {
  args: { comments: consoleCommentsFixture, isLoading: false, error: null },
};

export const Loading: Story = {
  args: { comments: [], isLoading: true, error: null },
};

export const Empty: Story = {
  args: { comments: [], isLoading: false, error: null },
};

export const NotLoaded: Story = {
  args: {
    comments: [],
    isLoading: false,
    error: 'API rate limit already exceeded',
  },
};

export const WithWorkflowLink: Story = {
  args: {
    comments: consoleCommentsFixture,
    isLoading: false,
    error: null,
    workflowImprovementIssueUrl:
      'https://github.com/HiromiShikata/umino-corporait-operation/issues/new?assignees=HiromiShikata',
  },
};
