import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleMermaidDiagramModalScreen } from './ConsoleMermaidDiagramModalScreen';

const wideDiagramSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 320" width="100%" style="max-width: 1600px;">
  <rect x="0" y="0" width="1600" height="320" fill="#0d1117" />
  <rect x="40" y="60" width="320" height="90" fill="#161b22" stroke="#30363d" />
  <text x="60" y="110" fill="#e6edf3" font-size="20">Deal</text>
  <rect x="640" y="60" width="320" height="90" fill="#161b22" stroke="#30363d" />
  <text x="660" y="110" fill="#e6edf3" font-size="20">InformationMemorandum</text>
  <rect x="1240" y="60" width="320" height="90" fill="#161b22" stroke="#30363d" />
  <text x="1260" y="110" fill="#e6edf3" font-size="20">RequirementCoverage</text>
  <line x1="360" y1="105" x2="640" y2="105" stroke="#8b949e" stroke-width="2" />
  <line x1="960" y1="105" x2="1240" y2="105" stroke="#8b949e" stroke-width="2" />
</svg>`;

const meta: Meta<typeof ConsoleMermaidDiagramModalScreen> = {
  title: 'Console/ConsoleMermaidDiagramModalScreen',
  component: ConsoleMermaidDiagramModalScreen,
};

export default meta;

type Story = StoryObj<typeof ConsoleMermaidDiagramModalScreen>;

export const WideDiagram: Story = {
  args: { svg: wideDiagramSvg, onClose: () => {} },
};
