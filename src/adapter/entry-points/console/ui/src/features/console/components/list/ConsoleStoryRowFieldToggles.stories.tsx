import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryRowFieldToggles } from './ConsoleStoryRowFieldToggles';

const meta: Meta<typeof ConsoleStoryRowFieldToggles> = {
  title: 'Console/ConsoleStoryRowFieldToggles',
  component: ConsoleStoryRowFieldToggles,
  args: {
    hiddenFields: [],
    onToggle: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryRowFieldToggles>;

export const AllFieldsShown: Story = {};

export const SomeFieldsHidden: Story = {
  args: {
    hiddenFields: ['trigger', 'status'],
  },
};
