import { fireEvent, render, screen } from '@testing-library/react';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

describe('ConsoleMermaidDiagram', () => {
  it('renders the diagram in the Mermaid frame', () => {
    render(<ConsoleMermaidDiagram code="graph TD; A-->B;" />);
    expect(screen.getByTitle('Mermaid diagram')).toBeInTheDocument();
  });

  it('opens the enlarged view carrying the same diagram', () => {
    render(<ConsoleMermaidDiagram code="graph TD; A-->B;" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('Enlarge diagram'));
    const dialog = screen.getByRole('dialog');
    expect(
      dialog.querySelector('iframe[title="Mermaid diagram"]'),
    ).not.toBeNull();
  });

  it('closes the enlarged view again', () => {
    render(<ConsoleMermaidDiagram code="graph TD; A-->B;" />);
    fireEvent.click(screen.getByText('Enlarge diagram'));
    fireEvent.click(screen.getByLabelText('Close enlarged diagram'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
