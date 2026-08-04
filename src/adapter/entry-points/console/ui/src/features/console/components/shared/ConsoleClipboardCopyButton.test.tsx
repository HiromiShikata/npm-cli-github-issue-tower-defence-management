import { act, fireEvent, render } from '@testing-library/react';
import { ConsoleClipboardCopyButton } from './ConsoleClipboardCopyButton';

const value = 'first line\nsecond line\n';

const renderButton = () =>
  render(
    <ConsoleClipboardCopyButton
      value={value}
      idleText="Copy code"
      idleAriaLabel="Copy code"
      copiedAriaLabel="Code copied to clipboard"
      className="console-copy-code-button"
    />,
  );

describe('ConsoleClipboardCopyButton', () => {
  const writeText = jest.fn(async () => {});

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders the idle text and idle accessible name', () => {
    const { getByRole } = renderButton();
    expect(getByRole('button', { name: 'Copy code' })).toHaveTextContent(
      'Copy code',
    );
  });

  it('writes the value verbatim and switches to the copied accessible name', async () => {
    const { getByRole } = renderButton();
    await act(async () => {
      fireEvent.click(getByRole('button'));
    });
    expect(writeText).toHaveBeenCalledWith(value);
    expect(
      getByRole('button', { name: 'Code copied to clipboard' }),
    ).toHaveTextContent('Copied');
  });

  it('reverts to the idle state after the feedback delay', async () => {
    jest.useFakeTimers();
    try {
      const { getByRole, queryByText } = renderButton();
      await act(async () => {
        fireEvent.click(getByRole('button'));
      });
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(queryByText('Copied')).toBeNull();
      expect(getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('copies through the document selection command when the clipboard api is absent', async () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    const { getByRole } = renderButton();

    await act(async () => {
      fireEvent.click(getByRole('button'));
    });

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(
      getByRole('button', { name: 'Code copied to clipboard' }),
    ).toHaveTextContent('Copied');
  });

  it('shows a failed state when no copy mechanism succeeds', async () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: jest.fn().mockReturnValue(false),
    });
    const { getByRole } = renderButton();

    await act(async () => {
      fireEvent.click(getByRole('button'));
    });

    expect(getByRole('button')).toHaveTextContent('Copy failed');
  });

  it('applies the given class name to the rendered button', () => {
    const { getByRole } = renderButton();
    expect(getByRole('button')).toHaveClass('console-copy-code-button');
  });
});
