import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleMermaidCodeFixture } from '../fixtures';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

const meta: Meta<typeof ConsoleMermaidDiagram> = {
  title: 'Console/ConsoleMermaidDiagram',
  component: ConsoleMermaidDiagram,
};

export default meta;

type Story = StoryObj<typeof ConsoleMermaidDiagram>;

export const SequenceDiagram: Story = {
  args: { code: consoleMermaidCodeFixture },
};

export const FlowDiagram: Story = {
  args: {
    code: 'graph TD;\n  Start-->Fetch;\n  Fetch-->Render;\n  Render-->Done;',
  },
};
