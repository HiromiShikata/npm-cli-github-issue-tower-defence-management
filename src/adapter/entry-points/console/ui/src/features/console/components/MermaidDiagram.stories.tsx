import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleMermaidDiagramFixture } from '../fixtures';
import { MermaidDiagram } from './MermaidDiagram';

const meta: Meta<typeof MermaidDiagram> = {
  title: 'Console/MermaidDiagram',
  component: MermaidDiagram,
};

export default meta;

type Story = StoryObj<typeof MermaidDiagram>;

export const SequenceDiagram: Story = {
  args: { source: consoleMermaidDiagramFixture },
};

export const FlowChart: Story = {
  args: {
    source: [
      'graph LR',
      '  Token[Access token] --> List[useConsoleList]',
      '  List --> Counts[useConsoleTabCounts]',
      '  List --> Detail[useConsoleItemDetail]',
    ].join('\n'),
  },
};
