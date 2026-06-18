import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consolePullRequestDetailFixture,
  consoleRelatedPullRequestsFixture,
} from '../fixtures';
import { PullRequestSection } from './PullRequestSection';

const meta: Meta<typeof PullRequestSection> = {
  title: 'Console/PullRequestSection',
  component: PullRequestSection,
};

export default meta;

type Story = StoryObj<typeof PullRequestSection>;

export const WithDetail: Story = {
  args: {
    detail: consolePullRequestDetailFixture,
    relatedPullRequests: consoleRelatedPullRequestsFixture,
    isLoading: false,
    error: null,
  },
};

export const DirectPullRequest: Story = {
  args: {
    detail: consolePullRequestDetailFixture,
    relatedPullRequests: [],
    isLoading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    detail: null,
    relatedPullRequests: [],
    isLoading: true,
    error: null,
  },
};

export const ErrorState: Story = {
  args: {
    detail: null,
    relatedPullRequests: [],
    isLoading: false,
    error: 'HTTP 502',
  },
};
