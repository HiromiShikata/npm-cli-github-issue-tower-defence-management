import type { Meta, StoryObj } from '@storybook/react-vite';
import { FleetTaskCreateModalDialog } from './FleetTaskCreateModalDialog';

const meta: Meta<typeof FleetTaskCreateModalDialog> = {
  title: 'Console/FleetTaskCreateModalDialog',
  component: FleetTaskCreateModalDialog,
  args: {
    onSubmit: () => Promise.resolve(),
    onClose: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof FleetTaskCreateModalDialog>;

export const Default: Story = {};

export const Submitting: Story = {
  args: {
    onSubmit: () => new Promise(() => {}),
  },
};

export const WithError: Story = {
  args: {
    onSubmit: () => Promise.reject(new Error('Network failure')),
  },
};

export const WithDraft: Story = {
  args: {
    initialTitle: 'Fix CI pipeline for console UI build',
  },
};
