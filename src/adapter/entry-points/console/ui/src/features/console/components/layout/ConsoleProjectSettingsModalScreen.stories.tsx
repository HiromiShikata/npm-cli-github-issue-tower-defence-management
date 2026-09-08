import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleProjectSettingsModalScreen } from './ConsoleProjectSettingsModalScreen';

const meta: Meta<typeof ConsoleProjectSettingsModalScreen> = {
  title: 'Console/ConsoleProjectSettingsModalScreen',
  component: ConsoleProjectSettingsModalScreen,
  args: {
    pjcodes: ['acme', 'beta', 'gamma'],
    inputValues: { acme: '5', beta: '3', gamma: '8' },
    onChangeInput: () => {},
    isLoading: false,
    isSaving: false,
    error: null,
    onSave: () => {},
    onClose: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleProjectSettingsModalScreen>;

export const WithCurrentValues: Story = {};

export const NoCurrentValues: Story = {
  args: {
    inputValues: {},
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    inputValues: {},
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
