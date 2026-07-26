import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleCopyUrlButton } from './ConsoleCopyUrlButton';

const meta: Meta<typeof ConsoleCopyUrlButton> = {
  title: 'Console/ConsoleCopyUrlButton',
  component: ConsoleCopyUrlButton,
};

export default meta;

type Story = StoryObj<typeof ConsoleCopyUrlButton>;

export const IssueUrl: Story = {
  args: {
    url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845',
  },
};

export const PullRequestUrl: Story = {
  args: {
    url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/851',
    label: 'Copy PR URL',
  },
};
