import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleClipboardCopyButton } from './ConsoleClipboardCopyButton';

const meta: Meta<typeof ConsoleClipboardCopyButton> = {
  title: 'Console/ConsoleClipboardCopyButton',
  component: ConsoleClipboardCopyButton,
};

export default meta;

type Story = StoryObj<typeof ConsoleClipboardCopyButton>;

export const UrlValue: Story = {
  args: {
    value:
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845',
    idleText: 'Copy URL',
    idleAriaLabel: 'Copy URL',
    copiedAriaLabel: 'URL copied to clipboard',
    className: 'console-copy-url-button',
  },
};

export const CodeValue: Story = {
  args: {
    value: 'npm run build:console-ui\nnode scripts/copyConsoleUiDist.mjs\n',
    idleText: 'Copy code',
    idleAriaLabel: 'Copy code',
    copiedAriaLabel: 'Code copied to clipboard',
    className: 'console-copy-code-button',
  },
};
