import type { Meta, StoryObj } from '@storybook/react-vite';
import { MERMAID_FRAME_MOCK_SOURCE } from '../../testing/mermaidFrameMock';
import { ConsoleMermaidFrame } from './ConsoleMermaidFrame';

const meta: Meta<typeof ConsoleMermaidFrame> = {
  title: 'Console/ConsoleMermaidFrame',
  component: ConsoleMermaidFrame,
};

export default meta;

type Story = StoryObj<typeof ConsoleMermaidFrame>;

export const FlowDiagram: Story = {
  args: {
    code: 'graph TD;\n  Start-->Fetch;\n  Fetch-->Render;\n  Render-->Done;',
    fillWidth: false,
    frameSource: MERMAID_FRAME_MOCK_SOURCE,
  },
};

export const FillWidth: Story = {
  args: {
    code: 'graph LR;\n  Deal-->InformationMemorandum-->RequirementCoverage;',
    fillWidth: true,
    frameSource: MERMAID_FRAME_MOCK_SOURCE,
  },
};

export const FrameDoesNotRespond: Story = {
  args: {
    code: 'graph TD;\n  Start-->Done;',
    fillWidth: false,
    frameSource: 'about:blank',
  },
};
