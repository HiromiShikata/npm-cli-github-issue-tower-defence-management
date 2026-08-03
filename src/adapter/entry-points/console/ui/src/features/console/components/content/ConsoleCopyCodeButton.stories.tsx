import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleCopyCodeButton } from './ConsoleCopyCodeButton';

const meta: Meta<typeof ConsoleCopyCodeButton> = {
  title: 'Console/ConsoleCopyCodeButton',
  component: ConsoleCopyCodeButton,
};

export default meta;

type Story = StoryObj<typeof ConsoleCopyCodeButton>;

export const MultiLineTypeScript: Story = {
  args: {
    code: `export const splitMarkdownSegments = (source: string): ConsoleMarkdownSegment[] => {
  const lines = source.split('\\n');
  return lines.length > 0 ? parse(lines) : [];
};
`,
  },
};

export const ShellCommand: Story = {
  args: {
    code: 'npm run build:console-ui\nnode scripts/copyConsoleUiDist.mjs\n',
    label: 'Copy command',
  },
};
