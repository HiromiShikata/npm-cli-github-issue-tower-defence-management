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
