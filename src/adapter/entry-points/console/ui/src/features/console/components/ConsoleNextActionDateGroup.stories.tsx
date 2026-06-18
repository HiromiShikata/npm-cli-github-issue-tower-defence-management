import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleNextActionDateGroup } from './ConsoleNextActionDateGroup';

const meta: Meta<typeof ConsoleNextActionDateGroup> = {
  title: 'Console/ConsoleNextActionDateGroup',
  component: ConsoleNextActionDateGroup,
};

export default meta;

type Story = StoryObj<typeof ConsoleNextActionDateGroup>;

export const PrsTabStaysInPlace: Story = {
  args: { tab: 'prs', onSnooze: () => undefined },
};

export const TodoByHumanAdvancesAndSkips: Story = {
  args: { tab: 'todo-by-human', onSnooze: () => undefined },
};
