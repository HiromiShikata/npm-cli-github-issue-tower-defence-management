import { render, screen, waitFor } from '@testing-library/react';
import { MermaidDiagram } from './MermaidDiagram';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(async (_id: string, source: string) => {
      if (source.includes('boom')) {
        throw new Error('syntax error');
      }
      return { svg: '<svg><rect width="10" height="10"></rect></svg>' };
    }),
  },
}));

describe('MermaidDiagram', () => {
  it('renders the sanitized svg for a valid diagram', async () => {
    const { container } = render(
      <MermaidDiagram source="graph TD\n A --> B" />,
    );
    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('shows an error message when rendering fails', async () => {
    render(<MermaidDiagram source="boom" />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('syntax error');
    });
  });
});
