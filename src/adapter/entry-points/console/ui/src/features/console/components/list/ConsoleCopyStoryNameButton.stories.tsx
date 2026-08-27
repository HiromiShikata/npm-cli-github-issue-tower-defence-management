import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleCopyStoryNameButton } from './ConsoleCopyStoryNameButton';

const meta: Meta<typeof ConsoleCopyStoryNameButton> = {
  title: 'Console/ConsoleCopyStoryNameButton',
  component: ConsoleCopyStoryNameButton,
};

export default meta;

type Story = StoryObj<typeof ConsoleCopyStoryNameButton>;

export const SimpleStoryName: Story = {
  args: {
    storyName: 'TDPM Console port',
  },
};

export const RegularPrefixedStoryName: Story = {
  args: {
    storyName: 'regular / regular payment invoice tax',
  },
};
