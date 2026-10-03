import { act, fireEvent, render } from '@testing-library/react';
import { ConsoleInlineCodeCopy } from './ConsoleInlineCodeCopy';

describe('ConsoleInlineCodeCopy', () => {
  const writeText = jest.fn(async () => {});

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders the button with a pointer cursor set directly on the element', () => {
    const { getByRole } = render(<ConsoleInlineCodeCopy code="foo" />);
    const button = getByRole('button');
    expect(getComputedStyle(button).cursor).toBe('pointer');
    expect(button.style.cursor).toBe('pointer');
  });

  it('writes the code prop text verbatim to the clipboard when clicked', async () => {
    const code = 'git status';
    const { getByRole } = render(<ConsoleInlineCodeCopy code={code} />);
    await act(async () => {
      fireEvent.click(getByRole('button'));
    });
    expect(writeText).toHaveBeenCalledWith(code);
  });

  it('is a native button element whose click triggers the same clipboard write that a real Enter or Space activation would produce', async () => {
    const code = 'echo hi';
    const { getByRole } = render(<ConsoleInlineCodeCopy code={code} />);
    const button = getByRole('button');
    expect(button.tagName).toBe('BUTTON');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(code);
  });

  it('shows a success tooltip and the copied aria-label while leaving the code text unchanged', async () => {
    const code = 'npm install';
    const { getByRole } = render(<ConsoleInlineCodeCopy code={code} />);
    const button = getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(code);
    expect(button.textContent).toBe(code);
    const status = getByRole('status');
    expect(status.textContent).toBe('Copied');
    expect(button).toHaveAttribute('aria-label', 'Code copied to clipboard');
  });

  it('shows a failed tooltip and the failed aria-label when the clipboard write fails, leaving the code text unchanged', async () => {
    const code = 'npm test';
    const failingWriteText = jest.fn(async () => {
      throw new Error('denied');
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: failingWriteText },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: jest.fn().mockReturnValue(false),
    });
    const { getByRole } = render(<ConsoleInlineCodeCopy code={code} />);
    const button = getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button.textContent).toBe(code);
    const status = getByRole('status');
    expect(status.textContent).toBe('Copy failed');
    expect(button).toHaveAttribute(
      'aria-label',
      'Copying to the clipboard failed',
    );
  });

  it('shows a failed tooltip when the clipboard api rejects even though the document selection command would succeed, leaving the code text unchanged', async () => {
    const code = 'npm run build';
    const failingWriteText = jest.fn(async () => {
      throw new Error('denied');
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: failingWriteText },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: jest.fn().mockReturnValue(true),
    });
    const { getByRole } = render(<ConsoleInlineCodeCopy code={code} />);
    const button = getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button.textContent).toBe(code);
    const status = getByRole('status');
    expect(status.textContent).toBe('Copy failed');
    expect(button).toHaveAttribute(
      'aria-label',
      'Copying to the clipboard failed',
    );
  });

  it('reverts to idle 1500ms after a copy, and a repeated click while the tooltip is showing restarts the timer instead of letting it expire on schedule', async () => {
    jest.useFakeTimers();
    try {
      const code = 'foo';
      const { getByRole, getByText, queryByText } = render(
        <ConsoleInlineCodeCopy code={code} />,
      );
      const button = getByRole('button');

      await act(async () => {
        fireEvent.click(button);
      });
      expect(getByText('Copied')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(750);
      });
      expect(getByText('Copied')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(button);
      });
      expect(writeText).toHaveBeenCalledTimes(2);

      act(() => {
        jest.advanceTimersByTime(750);
      });
      const stillShowingAtFifteenHundredMsFromFirstClick = getByText('Copied');
      expect(stillShowingAtFifteenHundredMsFromFirstClick).toBeInTheDocument();
      expect(button.textContent).toBe(code);

      act(() => {
        jest.advanceTimersByTime(750);
      });
      expect(queryByText('Copied')).toBeNull();
      expect(button.textContent).toBe(code);
      expect(button).not.toHaveAttribute('aria-label');
    } finally {
      jest.useRealTimers();
    }
  });
});
