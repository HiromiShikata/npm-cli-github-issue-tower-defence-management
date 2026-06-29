import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsolePullRequestStatusBadges } from './ConsolePullRequestStatusBadges';

const meta: Meta<typeof ConsolePullRequestStatusBadges> = {
  title: 'Console/ConsolePullRequestStatusBadges',
  component: ConsolePullRequestStatusBadges,
};

export default meta;

type Story = StoryObj<typeof ConsolePullRequestStatusBadges>;

export const PassingAndMergeable: Story = {
  args: {
    mergeableStatus: 'MERGEABLE',
    isPassedAllCiJob: true,
    isCiStateSuccess: true,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: [],
  },
};

export const FailingWithMissingChecks: Story = {
  args: {
    mergeableStatus: 'MERGEABLE',
    isPassedAllCiJob: false,
    isCiStateSuccess: false,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: ['build', 'test'],
  },
};

export const ConflictingAndOutOfDate: Story = {
  args: {
    mergeableStatus: 'CONFLICTING',
    isPassedAllCiJob: false,
    isCiStateSuccess: false,
    isBranchOutOfDate: true,
    missingRequiredCheckNames: ['build', 'test'],
  },
};

export const CheckingMergeStatus: Story = {
  args: {
    mergeableStatus: 'UNKNOWN',
    isPassedAllCiJob: true,
    isCiStateSuccess: true,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: [],
  },
};
