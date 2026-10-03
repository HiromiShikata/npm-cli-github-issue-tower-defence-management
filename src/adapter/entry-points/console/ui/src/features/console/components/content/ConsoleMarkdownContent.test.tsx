import { act, fireEvent, render, waitFor } from '@testing-library/react';
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
      await act(async () => {
        fireEvent.click(button);
      });
      expect(writeText).toHaveBeenCalledWith(multiLineCodeText);
    });

    it('copies only the text content of the code block without the control label', async () => {
      const { container, findAllByRole } = render(
        <ConsoleMarkdownContent body={multiLineCodeBody} />,
      );
      const [button] = await findAllByRole('button', { name: 'Copy code' });
      expect(container.textContent).toContain('Copy code');
      await act(async () => {
        fireEvent.click(button);
      });
      const codeElement = container.querySelector('pre > code');
      expect(codeElement?.textContent).toBe(multiLineCodeText);
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
      await act(async () => {
        fireEvent.click(buttons[0]);
      });
      expect(writeText).toHaveBeenNthCalledWith(1, 'const first = 1;\n');
      await act(async () => {
        fireEvent.click(buttons[1]);
      });
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

  describe('inline code copy control', () => {
    const writeText = jest.fn(async () => {});

    beforeEach(() => {
      writeText.mockClear();
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
    });

    it('copies the exact displayed text of a rendered inline code element', async () => {
      const { container, findAllByRole } = render(
        <ConsoleMarkdownContent body="See `foo` for details." />,
      );
      const buttons = await findAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(container.querySelector('code')?.textContent).toBe('foo');
      await act(async () => {
        fireEvent.click(buttons[0]);
      });
      expect(writeText).toHaveBeenCalledWith('foo');
    });

    it('leaves every other inline code element unchanged when one of several is clicked', async () => {
      const { container, findAllByRole } = render(
        <ConsoleMarkdownContent body="Compare `foo` and `bar`." />,
      );
      const buttons = await findAllByRole('button');
      expect(buttons).toHaveLength(2);
      const codeTextsBefore = Array.from(
        container.querySelectorAll('code'),
      ).map((element) => element.textContent);
      expect(codeTextsBefore).toEqual(['foo', 'bar']);

      await act(async () => {
        fireEvent.click(buttons[0]);
      });

      const codeTextsAfter = Array.from(container.querySelectorAll('code')).map(
        (element) => element.textContent,
      );
      expect(codeTextsAfter).toEqual(['foo', 'bar']);
      expect(writeText).toHaveBeenCalledWith('foo');
      expect(writeText).not.toHaveBeenCalledWith('bar');
    });

    it('renders only the fenced block copy control for a body with one fenced block and zero inline backtick spans', async () => {
      const { findAllByRole } = render(
        <ConsoleMarkdownContent body={multiLineCodeBody} />,
      );
      const buttons = await findAllByRole('button');
      expect(buttons).toHaveLength(1);
      const fencedBlockButtons = await findAllByRole('button', {
        name: 'Copy code',
      });
      expect(fencedBlockButtons).toHaveLength(1);
    });

    it('adds exactly one inline copy target alongside an unrelated fenced code block', async () => {
      const bodyWithFencedBlockAndInlineCode = [
        multiLineCodeBody,
        '',
        'See `foo` for details.',
      ].join('\n');
      const { findAllByRole } = render(
        <ConsoleMarkdownContent body={bodyWithFencedBlockAndInlineCode} />,
      );
      const allButtons = await findAllByRole('button');
      expect(allButtons).toHaveLength(2);
      const fencedBlockButtons = await findAllByRole('button', {
        name: 'Copy code',
      });
      expect(fencedBlockButtons).toHaveLength(1);
      const inlineCopyButtons = await findAllByRole('button', {
        name: 'foo',
      });
      expect(inlineCopyButtons).toHaveLength(1);
    });

    it('leaves the fenced code block copy control unchanged when an inline code span is also present', async () => {
      const bodyWithFencedBlockAndInlineCode = [
        multiLineCodeBody,
        '',
        'See `foo` for details.',
      ].join('\n');
      const { findByRole } = render(
        <ConsoleMarkdownContent body={bodyWithFencedBlockAndInlineCode} />,
      );
      const fencedButton = await findByRole('button', { name: 'Copy code' });
      expect(fencedButton).toHaveTextContent('Copy code');

      await act(async () => {
        fireEvent.click(fencedButton);
      });

      expect(writeText).toHaveBeenCalledWith(multiLineCodeText);
      expect(
        await findByRole('button', { name: 'Code copied to clipboard' }),
      ).toHaveTextContent('Copied');
    });
  });

  describe('task-list checkbox interactivity', () => {
    it('keeps rendered checkboxes disabled and fires no callback on click when onCheckboxToggle is not provided', () => {
      const { container } = render(
        <ConsoleMarkdownContent body={'- [ ] a\n- [x] b'} />,
      );
      const checkboxes = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      expect(checkboxes).toHaveLength(2);
      checkboxes.forEach((checkbox) => {
        expect(checkbox.disabled).toBe(true);
      });
      const checkedBefore = checkboxes.map((checkbox) => checkbox.checked);
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      const checkedAfter = checkboxes.map((checkbox) => checkbox.checked);
      expect(checkedAfter).toEqual(checkedBefore);
    });

    it('removes the disabled attribute from rendered checkboxes when onCheckboxToggle is provided', async () => {
      const onCheckboxToggle = jest.fn();
      const { container } = render(
        <ConsoleMarkdownContent
          body={'- [ ] a\n- [x] b'}
          onCheckboxToggle={onCheckboxToggle}
        />,
      );
      await waitFor(() => {
        expect(
          container.querySelectorAll('input[type="checkbox"]').length,
        ).toBe(2);
      });
      const checkboxes = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      checkboxes.forEach((checkbox) => {
        expect(checkbox.disabled).toBe(false);
      });
    });

    it('calls onCheckboxToggle exactly once with the clicked checkbox index and the checked state after the click', async () => {
      const onCheckboxToggle = jest.fn();
      const { container } = render(
        <ConsoleMarkdownContent
          body={'- [ ] a\n- [x] b'}
          onCheckboxToggle={onCheckboxToggle}
        />,
      );
      await waitFor(() => {
        expect(
          container.querySelectorAll('input[type="checkbox"]').length,
        ).toBe(2);
      });
      const secondCheckbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index="1"]',
      );
      expect(secondCheckbox).not.toBeNull();
      fireEvent.click(secondCheckbox as HTMLInputElement);
      expect(onCheckboxToggle).toHaveBeenCalledTimes(1);
      expect(onCheckboxToggle).toHaveBeenCalledWith(1, false);
    });

    it('calls onCheckboxToggle with checked=true when clicking an initially-unchecked checkbox', async () => {
      const onCheckboxToggle = jest.fn();
      const { container } = render(
        <ConsoleMarkdownContent
          body={'- [ ] a\n- [x] b'}
          onCheckboxToggle={onCheckboxToggle}
        />,
      );
      await waitFor(() => {
        expect(
          container.querySelectorAll('input[type="checkbox"]').length,
        ).toBe(2);
      });
      const firstCheckbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index="0"]',
      );
      expect(firstCheckbox).not.toBeNull();
      fireEvent.click(firstCheckbox as HTMLInputElement);
      expect(onCheckboxToggle).toHaveBeenCalledTimes(1);
      expect(onCheckboxToggle).toHaveBeenCalledWith(0, true);
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
