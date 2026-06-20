import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleChangedFilesFixture,
  consoleCommitsFixture,
  consoleRelatedPullRequestsFixture,
} from '../fixtures';
import { ConsolePullRequestSection } from './ConsolePullRequestSection';

const meta: Meta<typeof ConsolePullRequestSection> = {
  title: 'Console/ConsolePullRequestSection',
  component: ConsolePullRequestSection,
  args: { now: Date.parse('2026-06-19T12:00:00.000Z') },
};

export default meta;

type Story = StoryObj<typeof ConsolePullRequestSection>;

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
