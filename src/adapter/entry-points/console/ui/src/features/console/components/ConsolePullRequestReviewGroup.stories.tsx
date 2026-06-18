import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsolePullRequestReviewGroup } from './ConsolePullRequestReviewGroup';

const meta: Meta<typeof ConsolePullRequestReviewGroup> = {
  title: 'Console/ConsolePullRequestReviewGroup',
  component: ConsolePullRequestReviewGroup,
};

export default meta;

type Story = StoryObj<typeof ConsolePullRequestReviewGroup>;

export const Default: Story = {
  args: { onReview: () => undefined },
};
