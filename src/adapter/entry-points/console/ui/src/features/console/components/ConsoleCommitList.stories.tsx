import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleCommitsFixture } from '../fixtures';
import { ConsoleCommitList } from './ConsoleCommitList';

const meta: Meta<typeof ConsoleCommitList> = {
  title: 'Console/ConsoleCommitList',
  component: ConsoleCommitList,
  args: { now: Date.parse('2026-06-19T12:00:00.000Z') },
};

export default meta;

type Story = StoryObj<typeof ConsoleCommitList>;

export const WithCommits: Story = {
  args: { commits: consoleCommitsFixture, isLoading: false, error: null },
};

export const Loading: Story = {
  args: { commits: [], isLoading: true, error: null },
};

export const Empty: Story = {
  args: { commits: [], isLoading: false, error: null },
};
