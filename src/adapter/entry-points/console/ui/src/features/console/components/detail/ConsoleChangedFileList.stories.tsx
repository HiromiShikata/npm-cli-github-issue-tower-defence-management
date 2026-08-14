import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleChangedFilesFixture } from '../../testing/fixtures';
import { ConsoleChangedFileList } from './ConsoleChangedFileList';

const meta: Meta<typeof ConsoleChangedFileList> = {
  title: 'Console/ConsoleChangedFileList',
  component: ConsoleChangedFileList,
};

export default meta;

type Story = StoryObj<typeof ConsoleChangedFileList>;

export const WithFiles: Story = {
  args: { files: consoleChangedFilesFixture, isLoading: false, error: null },
};

export const Loading: Story = {
  args: { files: [], isLoading: true, error: null },
};

export const Empty: Story = {
  args: { files: [], isLoading: false, error: null },
};

export const NotLoaded: Story = {
  args: {
    files: [],
    isLoading: false,
    error: 'API rate limit already exceeded',
  },
};
