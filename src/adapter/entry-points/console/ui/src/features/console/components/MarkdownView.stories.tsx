import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleMarkdownBodyFixture,
  consoleMermaidBodyFixture,
} from '../fixtures';
import { MarkdownView } from './MarkdownView';

const meta: Meta<typeof MarkdownView> = {
  title: 'Console/MarkdownView',
  component: MarkdownView,
};

export default meta;

type Story = StoryObj<typeof MarkdownView>;

export const RichMarkdown: Story = {
  args: { source: consoleMarkdownBodyFixture },
};

export const WithMermaidFence: Story = {
  args: { source: consoleMermaidBodyFixture },
};

export const Empty: Story = {
  args: { source: '' },
};
