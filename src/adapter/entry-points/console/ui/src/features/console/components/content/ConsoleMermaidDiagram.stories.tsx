import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleMermaidCodeFixture } from '../../testing/fixtures';
import { MERMAID_FRAME_MOCK_SOURCE } from '../../testing/mermaidFrameMock';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

const meta: Meta<typeof ConsoleMermaidDiagram> = {
  title: 'Console/ConsoleMermaidDiagram',
  component: ConsoleMermaidDiagram,
};

export default meta;

type Story = StoryObj<typeof ConsoleMermaidDiagram>;

export const SequenceDiagram: Story = {
  args: {
    code: consoleMermaidCodeFixture,
    frameSource: MERMAID_FRAME_MOCK_SOURCE,
  },
};

export const FlowDiagram: Story = {
  args: {
    code: 'graph TD;\n  Start-->Fetch;\n  Fetch-->Render;\n  Render-->Done;',
    frameSource: MERMAID_FRAME_MOCK_SOURCE,
  },
};
