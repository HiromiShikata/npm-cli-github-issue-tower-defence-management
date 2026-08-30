import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleProjectSettingsModalScreen } from './ConsoleProjectSettingsModalScreen';

const meta: Meta<typeof ConsoleProjectSettingsModalScreen> = {
  title: 'Console/ConsoleProjectSettingsModalScreen',
  component: ConsoleProjectSettingsModalScreen,
  args: {
    value: '5',
    onChange: () => {},
    isLoading: false,
    isSaving: false,
    error: null,
    onSave: () => {},
    onClose: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleProjectSettingsModalScreen>;

export const WithCurrentValue: Story = {};

export const NoCurrentValue: Story = {
  args: {
    value: '',
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    value: '',
  },
};

export const Saving: Story = {
  args: {
    isSaving: true,
  },
};

export const WithError: Story = {
  args: {
    error: 'Failed to update project README: HTTP 502',
  },
};
