import type { Meta, StoryObj } from '@storybook/react-vite';
import { MERMAID_FRAME_MOCK_SOURCE } from '../../testing/mermaidFrameMock';
import { ConsoleMermaidDiagramModalScreen } from './ConsoleMermaidDiagramModalScreen';

const wideDiagramCode = `graph LR
  Deal --> InformationMemorandum --> RequirementCoverage`;

const meta: Meta<typeof ConsoleMermaidDiagramModalScreen> = {
  title: 'Console/ConsoleMermaidDiagramModalScreen',
  component: ConsoleMermaidDiagramModalScreen,
};

export default meta;

type Story = StoryObj<typeof ConsoleMermaidDiagramModalScreen>;

export const WideDiagram: Story = {
  args: {
    code: wideDiagramCode,
    frameSource: MERMAID_FRAME_MOCK_SOURCE,
    onClose: () => {},
  },
};
