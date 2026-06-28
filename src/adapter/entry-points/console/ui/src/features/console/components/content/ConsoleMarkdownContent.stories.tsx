import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildImageProxyUrl } from '../../lib/imageProxy';
import {
  consoleCodeFenceBodyFixture,
  consoleMarkdownBodyFixture,
  consoleMarkdownImageBodyFixture,
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

export const WithCodeFence: Story = {
  args: { body: consoleCodeFenceBodyFixture },
};

export const WithProxiedGitHubImages: Story = {
  args: {
    body: consoleMarkdownImageBodyFixture,
    buildImageProxyUrl: (src) =>
      buildImageProxyUrl(src, 'console-token-fixture'),
  },
};

export const Empty: Story = {
  args: { body: '' },
};
