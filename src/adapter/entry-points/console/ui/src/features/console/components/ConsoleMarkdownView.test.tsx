import { render, waitFor } from '@testing-library/react';
import { ConsoleMarkdownView } from './ConsoleMarkdownView';

jest.mock('../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(
    async () => '<svg data-testid="mermaid-svg"></svg>',
  ),
}));

describe('ConsoleMarkdownView', () => {
  it('renders markdown body content', () => {
    const { container } = render(
      <ConsoleMarkdownView body={'## Heading\n\n- bullet'} />,
    );
    expect(container.querySelector('h2')).not.toBeNull();
    expect(container.querySelector('li')).not.toBeNull();
  });

  it('shows the empty message for a blank body', () => {
    const { getByText } = render(<ConsoleMarkdownView body="   " />);
    expect(getByText('No description provided.')).toBeInTheDocument();
  });

  it('renders a mermaid fence via the diagram component', async () => {
    const { container } = render(
      <ConsoleMarkdownView
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
