import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleReferenceLink } from './ConsoleReferenceLink';

const meta: Meta<typeof ConsoleReferenceLink> = {
  title: 'Console/ConsoleReferenceLink',
  component: ConsoleReferenceLink,
};

export default meta;

type Story = StoryObj<typeof ConsoleReferenceLink>;

export const OpenPullRequest: Story = {
  args: {
    href: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/995',
    fallbackText:
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/995',
    state: {
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Rename serveConsole subcommand to serveWeb',
    },
  },
};

export const MergedPullRequest: Story = {
  args: {
    href: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/851',
    fallbackText:
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/851',
    state: {
      state: 'closed',
      merged: true,
      isPullRequest: true,
      title: 'Add serveConsole subcommand under entry-points',
    },
  },
};

export const OpenIssue: Story = {
  args: {
    href: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845',
    fallbackText:
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845',
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
  },
};

export const ClosedIssue: Story = {
  args: {
    href: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/692',
    fallbackText:
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/692',
    state: {
      state: 'closed',
      merged: false,
      isPullRequest: false,
      title: 'Publish the generated documentation site to GitHub Pages',
    },
  },
};

export const UnresolvedFallback: Story = {
  args: {
    href: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/995',
    fallbackText:
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/995',
    state: null,
  },
};
