import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsolePullRequestStatusBadges } from './ConsolePullRequestStatusBadges';

const meta: Meta<typeof ConsolePullRequestStatusBadges> = {
  title: 'Console/ConsolePullRequestStatusBadges',
  component: ConsolePullRequestStatusBadges,
};

export default meta;

type Story = StoryObj<typeof ConsolePullRequestStatusBadges>;

export const Passing: Story = {
  args: {
    ciStatusAvailability: 'AVAILABLE',
    isPassedAllCiJob: true,
    isCiStateSuccess: true,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: [],
  },
};

export const CiStatusUnknown: Story = {
  args: {
    ciStatusAvailability: 'UNAVAILABLE',
    isPassedAllCiJob: false,
    isCiStateSuccess: false,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: [],
  },
};

export const FailingWithMissingChecks: Story = {
  args: {
    ciStatusAvailability: 'AVAILABLE',
    isPassedAllCiJob: false,
    isCiStateSuccess: false,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: ['build', 'test'],
  },
};

export const FailingAndOutOfDate: Story = {
  args: {
    ciStatusAvailability: 'AVAILABLE',
    isPassedAllCiJob: false,
    isCiStateSuccess: false,
    isBranchOutOfDate: true,
    missingRequiredCheckNames: ['build', 'test'],
  },
};
