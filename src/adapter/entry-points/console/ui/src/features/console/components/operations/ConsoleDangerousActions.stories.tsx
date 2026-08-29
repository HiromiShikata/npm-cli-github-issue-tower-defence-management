import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleDangerousActions } from './ConsoleDangerousActions';

const meta: Meta<typeof ConsoleDangerousActions> = {
  title: 'Console/ConsoleDangerousActions',
  component: ConsoleDangerousActions,
  args: { onDeleteAllComments: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleDangerousActions>;

export const Default: Story = {};
