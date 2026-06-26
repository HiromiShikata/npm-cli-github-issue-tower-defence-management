import { fireEvent, render } from '@testing-library/react';
import { ConsoleErrorToast, ConsoleUndoToast } from './ConsoleUndoToast';

describe('ConsoleUndoToast', () => {
  const baseProps = {
    message: 'Approved — PR #851',
    color: 'green' as const,
    remainingSeconds: 5,
    progress: 1,
    onUndo: () => {},
  };

  it('shows the action message and the countdown', () => {
    const { getByText } = render(<ConsoleUndoToast {...baseProps} />);
    expect(getByText('Approved — PR #851')).toBeInTheDocument();
    expect(getByText('5s')).toBeInTheDocument();
  });

  it('renders the color modifier class', () => {
    const { container } = render(<ConsoleUndoToast {...baseProps} />);
    expect(
      container.querySelector('.console-undo-toast-green'),
    ).toBeInTheDocument();
  });

  it('shrinks the progress bar with the remaining fraction', () => {
    const { container } = render(
      <ConsoleUndoToast {...baseProps} progress={0.4} />,
    );
    const bar = container.querySelector(
      '.console-undo-toast-bar',
    ) as HTMLElement;
    expect(bar.style.width).toBe('40%');
  });

  it('clamps the progress bar width within 0 and 100 percent', () => {
    const { container } = render(
      <ConsoleUndoToast {...baseProps} progress={1.4} />,
    );
    const bar = container.querySelector(
      '.console-undo-toast-bar',
    ) as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('invokes onUndo when the Undo control is clicked', () => {
    const onUndo = jest.fn();
    const { getByText } = render(
      <ConsoleUndoToast {...baseProps} onUndo={onUndo} />,
    );
    fireEvent.click(getByText('Undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

describe('ConsoleErrorToast', () => {
  it('shows the failure message with the error modifier class and alert role', () => {
    const { getByText, container, getByRole } = render(
      <ConsoleErrorToast
        message="Operation failed: HTTP 422"
        onDismiss={() => {}}
      />,
    );
    expect(getByText('Operation failed: HTTP 422')).toBeInTheDocument();
    expect(
      container.querySelector('.console-undo-toast-error'),
    ).toBeInTheDocument();
    expect(getByRole('alert')).toBeInTheDocument();
  });

  it('does not render a countdown or progress bar', () => {
    const { container } = render(
      <ConsoleErrorToast
        message="Operation failed: boom"
        onDismiss={() => {}}
      />,
    );
    expect(
      container.querySelector('.console-undo-toast-countdown'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.console-undo-toast-bar'),
    ).not.toBeInTheDocument();
  });

  it('invokes onDismiss when the Dismiss control is clicked', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <ConsoleErrorToast
        message="Operation failed: boom"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
