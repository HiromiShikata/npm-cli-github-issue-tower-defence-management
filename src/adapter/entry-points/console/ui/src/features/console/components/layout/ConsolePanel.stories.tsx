import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsolePanel } from './ConsolePanel';

const meta: Meta<typeof ConsolePanel> = {
  title: 'Console/ConsolePanel',
  component: ConsolePanel,
};

export default meta;

type Story = StoryObj<typeof ConsolePanel>;

export const Expanded: Story = {
  args: {
    title: 'Description',
    children: <p style={{ padding: 12 }}>Panel body content</p>,
  },
};

export const Collapsed: Story = {
  args: {
    title: 'Commits',
    defaultCollapsed: true,
    children: <p style={{ padding: 12 }}>Panel body content</p>,
  },
};

export const WithCountAndOpenLink: Story = {
  args: {
    title: 'Description',
    headerAction: (
      <a
        href="https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/851"
        className="console-panel-open-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        open
      </a>
    ),
    children: <p style={{ padding: 12 }}>Panel body content</p>,
  },
};

export const ChangedFilesWithCount: Story = {
  args: {
    title: 'Changed files',
    count: 3,
    children: <p style={{ padding: 12 }}>Panel body content</p>,
  },
};
