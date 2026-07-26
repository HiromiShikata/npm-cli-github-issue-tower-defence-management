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

  it('decorates pull request and issue links via the reference renderer', async () => {
    const body =
      'See https://github.com/octo/repo/pull/7 and https://github.com/octo/repo/issues/9 for details.';
    const renderReferenceLink = jest.fn((href: string) => (
      <span className="decorated-reference" data-href={href}>
        decorated:{href}
      </span>
    ));
    const { container } = render(
      <ConsoleMarkdownContent
        body={body}
        renderReferenceLink={renderReferenceLink}
      />,
    );
    await waitFor(() => {
      expect(container.querySelectorAll('.decorated-reference').length).toBe(2);
    });
    const decoratedHrefs = Array.from(
      container.querySelectorAll('.decorated-reference'),
    ).map((node) => node.getAttribute('data-href'));
    expect(decoratedHrefs).toEqual([
      'https://github.com/octo/repo/pull/7',
      'https://github.com/octo/repo/issues/9',
    ]);
  });

  it('leaves non-issue links untouched', async () => {
    const body =
      'Docs at https://example.com/page and source https://github.com/octo/repo/blob/main/file.ts';
    const renderReferenceLink = jest.fn(() => (
      <span className="decorated-reference">decorated</span>
    ));
    const { container } = render(
      <ConsoleMarkdownContent
        body={body}
        renderReferenceLink={renderReferenceLink}
      />,
    );
    await waitFor(() => {
      const anchors = container.querySelectorAll('a[href]');
      expect(anchors.length).toBe(2);
    });
    expect(renderReferenceLink).not.toHaveBeenCalled();
    expect(container.querySelector('.decorated-reference')).toBeNull();
  });

  it('keeps reference links as plain anchors when no renderer is provided', () => {
    const { container } = render(
      <ConsoleMarkdownContent
        body={'See https://github.com/octo/repo/pull/7 now.'}
      />,
    );
    const anchor = container.querySelector('a[href]');
    expect(anchor?.getAttribute('href')).toBe(
      'https://github.com/octo/repo/pull/7',
    );
    expect(
      container.querySelector('.console-markdown-reference-host'),
    ).toBeNull();
  });
});
