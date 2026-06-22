import { fireEvent, render } from '@testing-library/react';
import { ConsoleUndoToast } from './ConsoleUndoToast';

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
