import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleMarkdownBodyFixture,
  consoleMermaidBodyFixture,
} from '../../testing/fixtures';
import { ConsoleMarkdownContent } from './ConsoleMarkdownContent';

const meta: Meta<typeof ConsoleMarkdownContent> = {
  title: 'Console/ConsoleMarkdownContent',
  component: ConsoleMarkdownContent,
};

export default meta;

type Story = StoryObj<typeof ConsoleMarkdownContent>;

export const RichMarkdown: Story = {
  args: { body: consoleMarkdownBodyFixture },
};

export const WithMermaidFence: Story = {
  args: { body: consoleMermaidBodyFixture },
};

export const Empty: Story = {
  args: { body: '' },
};
