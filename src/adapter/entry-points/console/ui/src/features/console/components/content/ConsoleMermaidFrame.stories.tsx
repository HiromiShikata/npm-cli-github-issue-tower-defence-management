import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleMermaidFrame } from './ConsoleMermaidFrame';

const MOCK_FRAME_SCRIPT = `
window.addEventListener('message', function (event) {
  if (event.source !== window.parent) { return; }
  var request = event.data;
  document.body.innerHTML = '';
  var pre = document.createElement('pre');
  pre.textContent = request.code;
  document.body.appendChild(pre);
  window.parent.postMessage({ type: 'size', requestId: request.requestId, height: 160 }, '*');
});
`;

const mockFrameSource = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body><script>${MOCK_FRAME_SCRIPT}</script></body></html>`)}`;

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
    frameSource: mockFrameSource,
  },
};

export const FillWidth: Story = {
  args: {
    code: 'graph LR;\n  Deal-->InformationMemorandum-->RequirementCoverage;',
    fillWidth: true,
    frameSource: mockFrameSource,
  },
};

export const FrameDoesNotRespond: Story = {
  args: {
    code: 'graph TD;\n  Start-->Done;',
    fillWidth: false,
    frameSource: 'about:blank',
  },
};
