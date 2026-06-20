import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleNextActionDateGroup } from './ConsoleNextActionDateGroup';

const meta: Meta<typeof ConsoleNextActionDateGroup> = {
  title: 'Console/ConsoleNextActionDateGroup',
  component: ConsoleNextActionDateGroup,
  args: { onSetNextActionDate: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleNextActionDateGroup>;

export const StandardTab: Story = {
  args: { isTodoByHuman: false },
};

export const TodoByHumanTab: Story = {
  args: { isTodoByHuman: true },
};
