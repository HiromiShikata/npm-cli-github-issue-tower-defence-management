import { fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleMarkdownContent } from './ConsoleMarkdownContent';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(
    async () => '<svg data-testid="mermaid-svg"></svg>',
  ),
}));

const multiLineCodeBody = [
  'Intro paragraph.',
  '',
  '```ts',
  'const first = 1;',
  'const second = first + 1;',
  '```',
].join('\n');

const multiLineCodeText = 'const first = 1;\nconst second = first + 1;\n';

const twoCodeBlocksBody = [
  '```ts',
  'const first = 1;',
  '```',
  '',
  'Between the blocks.',
  '',
  '```sh',
  'npm run build',
  'npm test',
  '```',
].join('\n');

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

  describe('code block copy control', () => {
    const writeText = jest.fn(async () => {});

    beforeEach(() => {
      writeText.mockClear();
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
    });

    it('renders a copy control for a rendered code block', async () => {
      const { findAllByRole } = render(
        <ConsoleMarkdownContent body={multiLineCodeBody} />,
      );
      const buttons = await findAllByRole('button', { name: 'Copy code' });
      expect(buttons).toHaveLength(1);
    });

    it('copies the multi-line code block text with its line breaks intact', async () => {
      const { findAllByRole } = render(
        <ConsoleMarkdownContent body={multiLineCodeBody} />,
      );
      const [button] = await findAllByRole('button', { name: 'Copy code' });
      fireEvent.click(button);
      expect(writeText).toHaveBeenCalledWith(multiLineCodeText);
    });

    it('copies only the text content of the code block without the control label', async () => {
      const { container, findAllByRole } = render(
        <ConsoleMarkdownContent body={multiLineCodeBody} />,
      );
      const [button] = await findAllByRole('button', { name: 'Copy code' });
      fireEvent.click(button);
      const codeElement = container.querySelector('pre > code');
      expect(codeElement?.textContent).toBe(multiLineCodeText);
      expect(container.textContent).toContain('Copy code');
      expect(writeText).toHaveBeenCalledWith(multiLineCodeText);
      expect(writeText).not.toHaveBeenCalledWith(
        expect.stringContaining('Copy code'),
      );
    });

    it('renders one copy control per code block and copies only that block', async () => {
      const { findAllByRole } = render(
        <ConsoleMarkdownContent body={twoCodeBlocksBody} />,
      );
      const buttons = await findAllByRole('button', { name: 'Copy code' });
      expect(buttons).toHaveLength(2);
      fireEvent.click(buttons[0]);
      expect(writeText).toHaveBeenNthCalledWith(1, 'const first = 1;\n');
      fireEvent.click(buttons[1]);
      expect(writeText).toHaveBeenNthCalledWith(2, 'npm run build\nnpm test\n');
    });

    it('leaves the mermaid diagram path without a code copy control', async () => {
      const { container, queryAllByRole } = render(
        <ConsoleMarkdownContent
          body={'intro\n\n```mermaid\ngraph TD; A-->B;\n```'}
        />,
      );
      await waitFor(() => {
        expect(
          container.querySelector('.console-mermaid-rendered'),
        ).not.toBeNull();
      });
      expect(queryAllByRole('button', { name: 'Copy code' })).toHaveLength(0);
    });
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
