import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleNextActionDateActions } from './ConsoleNextActionDateActions';

const meta: Meta<typeof ConsoleNextActionDateActions> = {
  title: 'Console/ConsoleNextActionDateActions',
  component: ConsoleNextActionDateActions,
  args: { onSetNextActionDate: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleNextActionDateActions>;

export const StandardTab: Story = {
  args: { isTodoByHuman: false },
};

export const TodoByHumanTab: Story = {
  args: { isTodoByHuman: true },
};
