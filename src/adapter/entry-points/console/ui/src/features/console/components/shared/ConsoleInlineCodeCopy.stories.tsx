import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { ConsoleInlineCodeCopy } from './ConsoleInlineCodeCopy';

const meta: Meta<typeof ConsoleInlineCodeCopy> = {
  title: 'Console/ConsoleInlineCodeCopy',
  component: ConsoleInlineCodeCopy,
};

export default meta;

type Story = StoryObj<typeof ConsoleInlineCodeCopy>;

export const Idle: Story = {
  args: {
    code: 'npm run build:console-ui',
  },
};

export const Focused: Story = {
  args: {
    code: 'npm run build:console-ui',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    button.focus();
  },
};

export const Copied: Story = {
  args: {
    code: 'npm run build:console-ui',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
  },
};

export const CopyFailed: Story = {
  args: {
    code: 'npm run build:console-ui',
  },
  play: async ({ canvasElement }) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('denied')),
      },
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
  },
};
