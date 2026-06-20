import { render, waitFor } from '@testing-library/react';
import { renderMermaidToSvg } from '../lib/mermaidLoader';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

jest.mock('../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(),
}));

const mockedRender = renderMermaidToSvg as jest.MockedFunction<
  typeof renderMermaidToSvg
>;

describe('ConsoleMermaidDiagram', () => {
  beforeEach(() => {
    mockedRender.mockReset();
  });

  it('renders the sanitized svg once ready', async () => {
    mockedRender.mockResolvedValue('<svg id="ok"></svg>');
    const { container } = render(
      <ConsoleMermaidDiagram code="graph TD; A-->B;" />,
    );
    await waitFor(() => {
      expect(container.querySelector('svg#ok')).not.toBeNull();
    });
  });

  it('shows the source and an error note when rendering fails', async () => {
    mockedRender.mockRejectedValue(new Error('parse error'));
    const { getByText } = render(<ConsoleMermaidDiagram code="bad diagram" />);
    await waitFor(() => {
      expect(
        getByText(/Mermaid render error: parse error/),
      ).toBeInTheDocument();
    });
    expect(getByText('bad diagram')).toBeInTheDocument();
  });
});
