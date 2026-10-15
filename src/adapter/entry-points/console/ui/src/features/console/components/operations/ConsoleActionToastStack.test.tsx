import { fireEvent, render, within } from '@testing-library/react';
import type {
  ConsoleActionError,
  ConsolePendingActionView,
} from '../../hooks/useConsoleActionQueue';
import { ConsoleActionToastStack } from './ConsoleActionToastStack';

const makePendingEntry = (
  overrides: Partial<ConsolePendingActionView> & { id: string },
): ConsolePendingActionView => ({
  createdAt: 0,
  message: 'Pending default',
  color: 'green',
  remainingSeconds: 5,
  progress: 1,
  ...overrides,
});

const makeErrorEntry = (
  overrides: Partial<ConsoleActionError> & { id: string },
): ConsoleActionError => ({
  createdAt: 0,
  message: 'Error default',
  reason: 'Reason default',
  ...overrides,
});

const baseProps = {
  displayLimit: 4,
  onUndo: () => {},
  onDismiss: () => {},
  onDismissError: () => {},
};

const getOverflowToggle = (
  container: HTMLElement,
  collapsedCount: number,
): HTMLElement => {
  const needle = `+${collapsedCount} more`;
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>('*'),
  ).filter((element) => element.textContent?.includes(needle) ?? false);
  const innermost = candidates.find(
    (element) =>
      !candidates.some(
        (other) => other !== element && element.contains(other),
      ),
  );
  if (innermost === undefined) {
    throw new Error(`overflow toggle with text "${needle}" not found`);
  }
  return innermost;
};

const findToastContainingText = (
  container: HTMLElement,
  text: string,
): HTMLElement => {
  const toasts = Array.from(
    container.querySelectorAll<HTMLElement>(
      '.console-undo-toast, .console-undo-toast-error',
    ),
  );
  const match = toasts.find((toast) => toast.textContent?.includes(text));
  if (match === undefined) {
    throw new Error(`no toast found containing "${text}"`);
  }
  return match;
};

describe('ConsoleActionToastStack', () => {
  it('renders nothing when there are no pending or error entries', () => {
    const { container } = render(
      <ConsoleActionToastStack
        {...baseProps}
        pendingEntries={[]}
        errorEntries={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders every entry with no overflow toggle when the total equals the display limit', () => {
    const pendingEntries = [
      makePendingEntry({ id: 'p-1', createdAt: 1, message: 'Pending One' }),
      makePendingEntry({ id: 'p-2', createdAt: 2, message: 'Pending Two' }),
    ];
    const errorEntries = [
      makeErrorEntry({
        id: 'e-1',
        createdAt: 3,
        message: 'Error One',
        reason: 'Reason One',
      }),
      makeErrorEntry({
        id: 'e-2',
        createdAt: 4,
        message: 'Error Two',
        reason: 'Reason Two',
      }),
    ];
    const { container, getByText } = render(
      <ConsoleActionToastStack
        {...baseProps}
        pendingEntries={pendingEntries}
        errorEntries={errorEntries}
      />,
    );
    expect(container.querySelectorAll('.console-undo-toast')).toHaveLength(2);
    expect(
      container.querySelectorAll('.console-undo-toast-error'),
    ).toHaveLength(2);
    expect(getByText('Pending One')).toBeInTheDocument();
    expect(getByText('Pending Two')).toBeInTheDocument();
    expect(container.textContent).toContain('Reason One');
    expect(container.textContent).toContain('Reason Two');
    expect(container.textContent).not.toMatch(/\+\d+ more/);
  });

  it('shows a "+1 more" toggle that reveals the single oldest entry when there is one more than the display limit', () => {
    const onUndo = jest.fn();
    const pendingEntries = [
      makePendingEntry({ id: 'p-1', createdAt: 1, message: 'Pending One' }),
      makePendingEntry({ id: 'p-2', createdAt: 2, message: 'Pending Two' }),
      makePendingEntry({ id: 'p-3', createdAt: 4, message: 'Pending Three' }),
      makePendingEntry({ id: 'p-4', createdAt: 5, message: 'Pending Four' }),
    ];
    const errorEntries = [
      makeErrorEntry({
        id: 'e-1',
        createdAt: 3,
        message: 'Error One',
        reason: 'Reason One',
      }),
    ];
    const { container, getByText, queryByText } = render(
      <ConsoleActionToastStack
        {...baseProps}
        onUndo={onUndo}
        pendingEntries={pendingEntries}
        errorEntries={errorEntries}
      />,
    );

    expect(queryByText('Pending One')).not.toBeInTheDocument();
    expect(getByText('Pending Two')).toBeInTheDocument();
    expect(container.textContent).toContain('Reason One');
    expect(getByText('Pending Three')).toBeInTheDocument();
    expect(getByText('Pending Four')).toBeInTheDocument();

    const toggle = getOverflowToggle(container, 1);
    expect(toggle.textContent).toContain('+1 more');

    fireEvent.click(toggle);

    expect(getByText('Pending One')).toBeInTheDocument();
    fireEvent.click(
      within(findToastContainingText(container, 'Pending One')).getByText(
        'Undo',
      ),
    );
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith('p-1');
  });

  it('shows a "+2 more" toggle that reveals the two oldest entries, oldest first, each independently wired to its own id', () => {
    const onUndo = jest.fn();
    const onDismissError = jest.fn();
    const pendingEntries = [
      makePendingEntry({ id: 'p-1', createdAt: 1, message: 'Pending One' }),
      makePendingEntry({ id: 'p-2', createdAt: 2, message: 'Pending Two' }),
      makePendingEntry({ id: 'p-3', createdAt: 4, message: 'Pending Three' }),
      makePendingEntry({ id: 'p-4', createdAt: 6, message: 'Pending Four' }),
    ];
    const errorEntries = [
      makeErrorEntry({
        id: 'e-1',
        createdAt: 3,
        message: 'Error One',
        reason: 'Reason One',
      }),
      makeErrorEntry({
        id: 'e-2',
        createdAt: 5,
        message: 'Error Two',
        reason: 'Reason Two',
      }),
    ];
    const { container, getByText, queryByText } = render(
      <ConsoleActionToastStack
        {...baseProps}
        onUndo={onUndo}
        onDismissError={onDismissError}
        pendingEntries={pendingEntries}
        errorEntries={errorEntries}
      />,
    );

    expect(queryByText('Pending One')).not.toBeInTheDocument();
    expect(queryByText('Pending Two')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.console-undo-toast')).toHaveLength(2);
    expect(
      container.querySelectorAll('.console-undo-toast-error'),
    ).toHaveLength(2);

    const toggle = getOverflowToggle(container, 2);
    expect(toggle.textContent).toContain('+2 more');

    fireEvent.click(toggle);

    expect(getByText('Pending One')).toBeInTheDocument();
    expect(getByText('Pending Two')).toBeInTheDocument();
    const fullText = container.textContent ?? '';
    expect(fullText.indexOf('Pending One')).toBeLessThan(
      fullText.indexOf('Pending Two'),
    );

    fireEvent.click(
      within(findToastContainingText(container, 'Pending One')).getByText(
        'Undo',
      ),
    );
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith('p-1');

    fireEvent.click(
      within(findToastContainingText(container, 'Pending Two')).getByText(
        'Undo',
      ),
    );
    expect(onUndo).toHaveBeenCalledTimes(2);
    expect(onUndo).toHaveBeenCalledWith('p-2');
  });
});
