import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleMarkdownBodyFixture,
  consoleMermaidBodyFixture,
} from '../fixtures';
import { ConsoleMarkdownView } from './ConsoleMarkdownView';

const meta: Meta<typeof ConsoleMarkdownView> = {
  title: 'Console/ConsoleMarkdownView',
  component: ConsoleMarkdownView,
};

export default meta;

type Story = StoryObj<typeof ConsoleMarkdownView>;

export const RichMarkdown: Story = {
  args: { body: consoleMarkdownBodyFixture },
};

export const WithMermaidFence: Story = {
  args: { body: consoleMermaidBodyFixture },
};

export const Empty: Story = {
  args: { body: '' },
};
