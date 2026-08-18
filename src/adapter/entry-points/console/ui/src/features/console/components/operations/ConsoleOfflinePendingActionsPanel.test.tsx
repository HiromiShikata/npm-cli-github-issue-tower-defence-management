import { fireEvent, render } from '@testing-library/react';
import {
  type ConsoleOfflinePendingActionItem,
  ConsoleOfflinePendingActionsPanel,
} from './ConsoleOfflinePendingActionsPanel';

const approveAction: ConsoleOfflinePendingActionItem = {
  id: 'offline-1',
  message: 'Approved — PR #851',
  color: 'green',
  itemNumber: 851,
  isPr: true,
  currentTitle: 'Add serveConsole subcommand under entry-points',
  currentState: 'open',
};

const baseProps = {
  actions: [approveAction],
  isOnline: true,
  isConfirming: false,
  onConfirm: () => {},
  onDiscard: () => {},
};

describe('ConsoleOfflinePendingActionsPanel', () => {
  it('renders nothing when the action list is empty', () => {
    const { container } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} actions={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the action count and a confirm-before-sending message when online', () => {
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} />,
    );
    expect(getByText(/1 action held/)).toBeInTheDocument();
    expect(getByText(/confirm each before sending/)).toBeInTheDocument();
  });

  it('shows an awaiting-connectivity message when offline', () => {
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} isOnline={false} />,
    );
    expect(getByText(/awaiting connectivity/)).toBeInTheDocument();
  });

  it('does not render per-action rows when offline', () => {
    const { queryByText } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} isOnline={false} />,
    );
    expect(queryByText('Send')).not.toBeInTheDocument();
    expect(queryByText('Discard')).not.toBeInTheDocument();
  });

  it('shows the action message and item label when online', () => {
    const { getByText, container } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} />,
    );
    expect(getByText('Approved — PR #851')).toBeInTheDocument();
    expect(
      container.querySelector('.console-offline-panel-item-target')
        ?.textContent,
    ).toContain('PR #851');
  });

  it('shows the current item title and state when loaded', () => {
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} />,
    );
    expect(
      getByText(/Add serveConsole subcommand under entry-points/),
    ).toBeInTheDocument();
    expect(getByText(/open/)).toBeInTheDocument();
  });

  it('shows a loading indicator when the current state is not yet fetched', () => {
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel
        {...baseProps}
        actions={[{ ...approveAction, currentTitle: null, currentState: null }]}
      />,
    );
    expect(getByText(/loading current state/)).toBeInTheDocument();
  });

  it('disables the Send button while the current state is loading', () => {
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel
        {...baseProps}
        actions={[{ ...approveAction, currentTitle: null, currentState: null }]}
      />,
    );
    expect(getByText('Send')).toBeDisabled();
  });

  it('enables the Send button once the current state is loaded', () => {
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} />,
    );
    expect(getByText('Send')).not.toBeDisabled();
  });

  it('disables the Send button while a confirmation is in progress', () => {
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} isConfirming={true} />,
    );
    expect(getByText('Send')).toBeDisabled();
  });

  it('calls onConfirm with the action id when Send is clicked', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel
        {...baseProps}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(getByText('Send'));
    expect(onConfirm).toHaveBeenCalledWith('offline-1');
  });

  it('calls onDiscard with the action id when Discard is clicked', () => {
    const onDiscard = jest.fn();
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel
        {...baseProps}
        onDiscard={onDiscard}
      />,
    );
    fireEvent.click(getByText('Discard'));
    expect(onDiscard).toHaveBeenCalledWith('offline-1');
  });

  it('uses plural phrasing for the count when more than one action is queued', () => {
    const { getByText } = render(
      <ConsoleOfflinePendingActionsPanel
        {...baseProps}
        actions={[
          approveAction,
          { ...approveAction, id: 'offline-2', message: 'Rejected — PR #853' },
        ]}
      />,
    );
    expect(getByText(/2 actions held/)).toBeInTheDocument();
  });

  it('renders a Send and Discard button for each queued action when online', () => {
    const { getAllByText } = render(
      <ConsoleOfflinePendingActionsPanel
        {...baseProps}
        actions={[
          approveAction,
          { ...approveAction, id: 'offline-2', message: 'Rejected — PR #853' },
        ]}
      />,
    );
    expect(getAllByText('Send')).toHaveLength(2);
    expect(getAllByText('Discard')).toHaveLength(2);
  });

  it('applies the color modifier class to the action row', () => {
    const { container } = render(
      <ConsoleOfflinePendingActionsPanel {...baseProps} />,
    );
    expect(
      container.querySelector('.console-offline-panel-item-green'),
    ).toBeInTheDocument();
  });
});
