import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  args: {
    children: 'PR',
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Pr: Story = {
  args: {
    variant: 'default',
    children: 'PR',
  },
};

export const Issue: Story = {
  args: {
    variant: 'secondary',
    children: 'Issue',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'story: TDPM Console port',
  },
};
