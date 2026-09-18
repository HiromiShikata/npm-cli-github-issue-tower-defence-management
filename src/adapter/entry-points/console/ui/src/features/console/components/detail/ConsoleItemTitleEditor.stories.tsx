import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleItemTitleEditor } from './ConsoleItemTitleEditor';

const meta: Meta<typeof ConsoleItemTitleEditor> = {
  title: 'Console/ConsoleItemTitleEditor',
  component: ConsoleItemTitleEditor,
  args: {
    title: 'Implement feature to edit task title inline',
    onTitleRename: async () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleItemTitleEditor>;

export const DisplayMode: Story = {};

export const SaveError: Story = {
  args: {
    onTitleRename: async () => {
      throw new Error('GitHub API error: Not Found');
    },
  },
};
