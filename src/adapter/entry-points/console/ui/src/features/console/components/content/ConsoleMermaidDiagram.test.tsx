import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderMermaidToSvg } from '../../lib/mermaidLoader';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

jest.mock('../../lib/mermaidLoader', () => ({
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

  it('opens the enlarged view carrying the same diagram', async () => {
    mockedRender.mockResolvedValue('<svg id="ok"></svg>');
    const { container } = render(
      <ConsoleMermaidDiagram code="graph TD; A-->B;" />,
    );
    await waitFor(() => {
      expect(container.querySelector('svg#ok')).not.toBeNull();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('Enlarge diagram'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('svg#ok')).not.toBeNull();
  });

  it('closes the enlarged view again', async () => {
    mockedRender.mockResolvedValue('<svg id="ok"></svg>');
    const { container } = render(
      <ConsoleMermaidDiagram code="graph TD; A-->B;" />,
    );
    await waitFor(() => {
      expect(container.querySelector('svg#ok')).not.toBeNull();
    });
    fireEvent.click(screen.getByText('Enlarge diagram'));
    fireEvent.click(screen.getByLabelText('Close enlarged diagram'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers no enlarged view while the diagram failed to render', async () => {
    mockedRender.mockRejectedValue(new Error('parse error'));
    render(<ConsoleMermaidDiagram code="bad diagram" />);
    await waitFor(() => {
      expect(screen.getByText(/Mermaid render error/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Enlarge diagram')).toBeNull();
  });
});
