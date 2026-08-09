import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsolePullRequestMergeableChip } from './ConsolePullRequestMergeableChip';

const meta: Meta<typeof ConsolePullRequestMergeableChip> = {
  title: 'Console/ConsolePullRequestMergeableChip',
  component: ConsolePullRequestMergeableChip,
};

export default meta;

type Story = StoryObj<typeof ConsolePullRequestMergeableChip>;

export const Mergeable: Story = {
  args: {
    mergeableStatus: 'MERGEABLE',
  },
};

export const Conflicting: Story = {
  args: {
    mergeableStatus: 'CONFLICTING',
  },
};

export const CheckingMergeStatus: Story = {
  args: {
    mergeableStatus: 'UNKNOWN',
  },
};
