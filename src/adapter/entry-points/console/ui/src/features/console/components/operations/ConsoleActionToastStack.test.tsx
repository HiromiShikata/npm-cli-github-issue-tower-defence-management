import { act, fireEvent, render, within } from '@testing-library/react';
import type {
  ConsoleActionError,
  ConsolePendingActionView,
} from '../../hooks/useConsoleActionQueue';
import { ACTION_TOAST_DELAY_MS } from '../../logic/actionToast';
import {
  ConsoleActionToastStack,
  type ConsoleActionToastStackProps,
} from './ConsoleActionToastStack';

const makePendingEntry = (
  overrides: Partial<ConsolePendingActionView> & { id: string },
): ConsolePendingActionView =>
  ({
    createdAt: 0,
    message: 'Pending default',
    color: 'green',
    ...overrides,
  }) as unknown as ConsolePendingActionView;

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
      !candidates.some((other) => other !== element && element.contains(other)),
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

const mockBoundingClientRectHeight = (
  element: HTMLElement,
  height: number,
): void => {
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    height,
    width: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
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

  it('stacks visible toasts bottom-to-top, placing the most recently created entry at the bottom inset and offsetting each older entry by the measured heights and gaps of the entries below it', () => {
    const pendingEntries = [
      makePendingEntry({ id: 'p-1', createdAt: 1, message: 'Pending One' }),
      makePendingEntry({ id: 'p-2', createdAt: 2, message: 'Pending Two' }),
    ];
    const { container, rerender } = render(
      <ConsoleActionToastStack
        {...baseProps}
        pendingEntries={pendingEntries}
        errorEntries={[]}
      />,
    );

    const toastOne = findToastContainingText(container, 'Pending One');
    const toastTwo = findToastContainingText(container, 'Pending Two');
    mockBoundingClientRectHeight(toastOne, 50);
    mockBoundingClientRectHeight(toastTwo, 30);

    rerender(
      <ConsoleActionToastStack
        {...baseProps}
        pendingEntries={pendingEntries}
        errorEntries={[]}
      />,
    );

    expect(toastTwo.style.bottom).toBe('12px');
    expect(toastOne.style.bottom).toBe(`${12 + 30 + 8}px`);
  });

  it('positions the overflow toggle above the stack of visible entries using their measured heights', () => {
    const pendingEntries = [
      makePendingEntry({ id: 'p-1', createdAt: 1, message: 'Pending One' }),
      makePendingEntry({ id: 'p-2', createdAt: 2, message: 'Pending Two' }),
    ];
    const { container, rerender } = render(
      <ConsoleActionToastStack
        {...baseProps}
        displayLimit={1}
        pendingEntries={pendingEntries}
        errorEntries={[]}
      />,
    );

    const toastTwo = findToastContainingText(container, 'Pending Two');
    mockBoundingClientRectHeight(toastTwo, 40);

    rerender(
      <ConsoleActionToastStack
        {...baseProps}
        displayLimit={1}
        pendingEntries={pendingEntries}
        errorEntries={[]}
      />,
    );

    const toggle = getOverflowToggle(container, 1);
    expect(toastTwo.style.bottom).toBe('12px');
    expect(toggle.style.bottom).toBe(`${12 + 40 + 8}px`);
  });

  it('wires Dismiss, Retry, and Dismiss independently for entries revealed by expanding the overflow toggle', () => {
    const onDismiss = jest.fn();
    const onDismissError = jest.fn();
    const retryOldError = jest.fn();
    const pendingEntries = [
      makePendingEntry({ id: 'p-old', createdAt: 1, message: 'Pending Old' }),
      makePendingEntry({
        id: 'p-visible',
        createdAt: 4,
        message: 'Pending Visible',
      }),
    ];
    const errorEntries = [
      makeErrorEntry({
        id: 'e-retry',
        createdAt: 2,
        message: 'Error Retry',
        reason: 'Reason Retry',
        retry: retryOldError,
      }),
      makeErrorEntry({
        id: 'e-dismiss',
        createdAt: 3,
        message: 'Error Dismiss',
        reason: 'Reason Dismiss',
      }),
    ];
    const { container } = render(
      <ConsoleActionToastStack
        {...baseProps}
        displayLimit={1}
        onDismiss={onDismiss}
        onDismissError={onDismissError}
        pendingEntries={pendingEntries}
        errorEntries={errorEntries}
      />,
    );

    const toggle = getOverflowToggle(container, 3);
    fireEvent.click(toggle);

    const pendingOldToast = findToastContainingText(container, 'Pending Old');
    fireEvent.click(within(pendingOldToast).getByText('✕'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('p-old');

    const errorRetryToast = findToastContainingText(container, 'Error Retry');
    expect(within(errorRetryToast).queryByText('Retry')).not.toBeNull();
    fireEvent.click(within(errorRetryToast).getByText('Retry'));
    expect(retryOldError).toHaveBeenCalledTimes(1);
    expect(onDismissError).toHaveBeenCalledTimes(1);
    expect(onDismissError).toHaveBeenCalledWith('e-retry');

    const errorDismissToast = findToastContainingText(
      container,
      'Error Dismiss',
    );
    expect(within(errorDismissToast).queryByText('Retry')).toBeNull();
    fireEvent.click(within(errorDismissToast).getByText('Dismiss'));
    expect(onDismissError).toHaveBeenCalledTimes(2);
    expect(onDismissError).toHaveBeenCalledWith('e-dismiss');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe('local countdown ticking', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('recalculates remainingSeconds and progress itself from createdAt every 100ms, independent of the pendingEntries prop values', () => {
      jest.useFakeTimers();
      const createdAt = Date.now();
      const { container } = render(
        <ConsoleActionToastStack
          {...baseProps}
          pendingEntries={[makePendingEntry({ id: 'p1', createdAt })]}
          errorEntries={[]}
        />,
      );

      const toastAtStart = findToastContainingText(
        container,
        'Pending default',
      );
      const countdownAtStart = toastAtStart.querySelector(
        '.console-undo-toast-countdown',
      );
      const barAtStart = toastAtStart.querySelector('.console-undo-toast-bar');
      expect(countdownAtStart?.textContent).toBe('5s');
      expect(barAtStart).toHaveStyle({ width: '100%' });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      const expectedRemainingSeconds = Math.max(
        0,
        Math.ceil((ACTION_TOAST_DELAY_MS - 2000) / 1000),
      );
      const expectedProgressPercent =
        Math.max(0, 1 - 2000 / ACTION_TOAST_DELAY_MS) * 100;
      const toastAfterTick = findToastContainingText(
        container,
        'Pending default',
      );
      const countdownAfterTick = toastAfterTick.querySelector(
        '.console-undo-toast-countdown',
      );
      const barAfterTick = toastAfterTick.querySelector(
        '.console-undo-toast-bar',
      );
      expect(countdownAfterTick?.textContent).toBe(
        `${expectedRemainingSeconds}s`,
      );
      expect(barAfterTick).toHaveStyle({
        width: `${expectedProgressPercent}%`,
      });
    });

    it('ticks its own countdown locally on a 100ms timer without ever re-rendering whatever renders it', () => {
      jest.useFakeTimers();
      const renderCounts: number[] = [];
      const ParentWrapper = (props: ConsoleActionToastStackProps) => {
        renderCounts.push(Date.now());
        return <ConsoleActionToastStack {...props} />;
      };
      const createdAt = Date.now();

      const { container } = render(
        <ParentWrapper
          {...baseProps}
          pendingEntries={[makePendingEntry({ id: 'p1', createdAt })]}
          errorEntries={[]}
        />,
      );
      const renderCountAfterInitialRender = renderCounts.length;

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(renderCounts.length).toBe(renderCountAfterInitialRender);

      const expectedRemainingSeconds = Math.max(
        0,
        Math.ceil((ACTION_TOAST_DELAY_MS - 2000) / 1000),
      );
      const toastAfterTick = findToastContainingText(
        container,
        'Pending default',
      );
      const countdownAfterTick = toastAfterTick.querySelector(
        '.console-undo-toast-countdown',
      );
      expect(countdownAfterTick?.textContent).toBe(
        `${expectedRemainingSeconds}s`,
      );
    });
  });
});
