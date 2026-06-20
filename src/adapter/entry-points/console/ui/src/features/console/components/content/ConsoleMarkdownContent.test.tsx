import { render, waitFor } from '@testing-library/react';
import { ConsoleMarkdownContent } from './ConsoleMarkdownContent';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(
    async () => '<svg data-testid="mermaid-svg"></svg>',
  ),
}));

describe('ConsoleMarkdownContent', () => {
  it('renders markdown body content', () => {
    const { container } = render(
      <ConsoleMarkdownContent body={'## Heading\n\n- bullet'} />,
    );
    expect(container.querySelector('h2')).not.toBeNull();
    expect(container.querySelector('li')).not.toBeNull();
  });

  it('shows the empty message for a blank body', () => {
    const { getByText } = render(<ConsoleMarkdownContent body="   " />);
    expect(getByText('No description provided.')).toBeInTheDocument();
  });

  it('renders a mermaid fence via the diagram component', async () => {
    const { container } = render(
      <ConsoleMarkdownContent
        body={'intro\n\n```mermaid\ngraph TD; A-->B;\n```'}
      />,
    );
    await waitFor(() => {
      expect(
        container.querySelector('.console-mermaid-rendered'),
      ).not.toBeNull();
    });
  });
});
