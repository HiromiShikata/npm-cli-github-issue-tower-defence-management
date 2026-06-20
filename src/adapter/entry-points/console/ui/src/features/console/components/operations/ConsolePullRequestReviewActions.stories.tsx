import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsolePullRequestReviewActions } from './ConsolePullRequestReviewActions';

const meta: Meta<typeof ConsolePullRequestReviewActions> = {
  title: 'Console/ConsolePullRequestReviewActions',
  component: ConsolePullRequestReviewActions,
  args: { onReview: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsolePullRequestReviewActions>;

export const Default: Story = {};
