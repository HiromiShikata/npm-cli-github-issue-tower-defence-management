import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleChangedFilesFixture,
  consoleCommitsFixture,
  consoleRelatedPullRequestsFixture,
} from '../../testing/fixtures';
import { ConsolePullRequestDetail } from './ConsolePullRequestDetail';

const meta: Meta<typeof ConsolePullRequestDetail> = {
  title: 'Console/ConsolePullRequestDetail',
  component: ConsolePullRequestDetail,
  args: { now: Date.parse('2026-06-19T12:00:00.000Z') },
};

export default meta;

type Story = StoryObj<typeof ConsolePullRequestDetail>;

export const WithDetail: Story = {
  args: {
    pullRequest: consoleRelatedPullRequestsFixture[0],
    body: consoleRelatedPullRequestsFixture[0].summary?.body ?? '',
    bodyIsLoading: false,
    files: consoleChangedFilesFixture,
    filesAreLoading: false,
    filesError: null,
    commits: consoleCommitsFixture,
    commitsAreLoading: false,
    commitsError: null,
  },
};

export const WithInlineComments: Story = {
  args: {
    pullRequest: consoleRelatedPullRequestsFixture[0],
    body: consoleRelatedPullRequestsFixture[0].summary?.body ?? '',
    bodyIsLoading: false,
    files: consoleChangedFilesFixture,
    filesAreLoading: false,
    filesError: null,
    commits: consoleCommitsFixture,
    commitsAreLoading: false,
    commitsError: null,
    onAddInlineComment: async (path, line, side, body) => {
      window.alert(`comment on ${path}:${line} (${side})\n${body}`);
    },
  },
};
