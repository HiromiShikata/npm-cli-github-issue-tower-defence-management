import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleStatusOptionsFixture } from '../../testing/fixtures';
import { ConsoleOkAndAwaitingWorkspaceActions } from './ConsoleOkAndAwaitingWorkspaceActions';

const meta: Meta<typeof ConsoleOkAndAwaitingWorkspaceActions> = {
  title: 'Console/ConsoleOkAndAwaitingWorkspaceActions',
  component: ConsoleOkAndAwaitingWorkspaceActions,
  args: { onOkAndAwaitingWorkspace: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleOkAndAwaitingWorkspaceActions>;

export const WithAwaitingWorkspaceOption: Story = {
  args: { statusOptions: consoleStatusOptionsFixture },
};

export const WithoutAwaitingWorkspaceOption: Story = {
  args: {
    statusOptions: consoleStatusOptionsFixture.filter(
      (o) => o.name.toLowerCase() !== 'awaiting workspace',
    ),
  },
};
