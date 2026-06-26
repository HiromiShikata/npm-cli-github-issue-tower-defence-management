import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleChangedFilesFixture } from '../../testing/fixtures';
import { ConsoleFileDiff } from './ConsoleFileDiff';

const meta: Meta<typeof ConsoleFileDiff> = {
  title: 'Console/ConsoleFileDiff',
  component: ConsoleFileDiff,
  args: { patch: consoleChangedFilesFixture[0].patch },
};

export default meta;

type Story = StoryObj<typeof ConsoleFileDiff>;

export const WithPatch: Story = {};

export const NoPatch: Story = {
  args: { patch: null },
};

export const WithInlineComments: Story = {
  args: {
    path: consoleChangedFilesFixture[0].path,
    onAddInlineComment: async (path, line, side, body) => {
      window.alert(`comment on ${path}:${line} (${side})\n${body}`);
    },
  },
};
