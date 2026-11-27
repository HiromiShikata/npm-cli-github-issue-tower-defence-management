import type { Meta, StoryObj } from '@storybook/react-vite';
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
  },
};

export const FillWidth: Story = {
  args: {
    code: 'graph LR;\n  Deal-->InformationMemorandum-->RequirementCoverage;',
    fillWidth: true,
  },
};
