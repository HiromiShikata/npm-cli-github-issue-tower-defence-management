import { fireEvent, render } from '@testing-library/react';
import {
  ConsoleAirplaneModeButton,
  type ConsoleAirplaneModeButtonProps,
} from './ConsoleAirplaneModeButton';

const baseProps: ConsoleAirplaneModeButtonProps = {
  status: 'off',
  progress: null,
  capturedAt: null,
  failures: [],
  onStartSync: jest.fn(),
  onTurnOff: jest.fn(),
};

describe('ConsoleAirplaneModeButton', () => {
  it('renders a start button when status is off', () => {
    const { getByRole } = render(<ConsoleAirplaneModeButton {...baseProps} />);
    const button = getByRole('button', { name: /airplane mode/i });
    expect(button).not.toBeNull();
  });

  it('calls onStartSync when the start button is clicked', () => {
    const onStartSync = jest.fn();
    const { getByRole } = render(
      <ConsoleAirplaneModeButton
        {...baseProps}
        status="off"
        onStartSync={onStartSync}
      />,
    );
    fireEvent.click(getByRole('button', { name: /airplane mode/i }));
    expect(onStartSync).toHaveBeenCalledTimes(1);
  });

  it('shows progress text when status is syncing', () => {
    const { getByRole } = render(
      <ConsoleAirplaneModeButton
        {...baseProps}
        status="syncing"
        progress={{ fetched: 10, total: 100 }}
      />,
    );
    const status = getByRole('status');
    expect(status.textContent).toContain('10/100');
  });

  it('shows Syncing… when progress total is zero', () => {
    const { getByRole } = render(
      <ConsoleAirplaneModeButton
        {...baseProps}
        status="syncing"
        progress={{ fetched: 0, total: 0 }}
      />,
    );
    expect(getByRole('status').textContent).toContain('Syncing');
  });

  it('does not show a done/on indicator while syncing', () => {
    const { queryByText } = render(
      <ConsoleAirplaneModeButton
        {...baseProps}
        status="syncing"
        progress={{ fetched: 3, total: 10 }}
      />,
    );
    expect(queryByText(/turn off/i)).toBeNull();
  });

  it('shows capturedAt and turn-off button when status is on', () => {
    const { getByText } = render(
      <ConsoleAirplaneModeButton
        {...baseProps}
        status="on"
        capturedAt="2026-01-01T00:00:00Z"
      />,
    );
    expect(getByText(/2026/)).not.toBeNull();
    expect(getByText(/turn off/i)).not.toBeNull();
  });

  it('calls onTurnOff when turn-off button is clicked', () => {
    const onTurnOff = jest.fn();
    const { getByRole } = render(
      <ConsoleAirplaneModeButton
        {...baseProps}
        status="on"
        capturedAt="2026-01-01T00:00:00Z"
        onTurnOff={onTurnOff}
      />,
    );
    fireEvent.click(getByRole('button', { name: /turn off/i }));
    expect(onTurnOff).toHaveBeenCalledTimes(1);
  });

  it('shows error state with retry button when status is error', () => {
    const onStartSync = jest.fn();
    const { getByRole, getByText } = render(
      <ConsoleAirplaneModeButton
        {...baseProps}
        status="error"
        failures={['https://github.com/o/r/issues/1']}
        onStartSync={onStartSync}
      />,
    );
    expect(getByText(/sync failed/i)).not.toBeNull();
    const retryBtn = getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onStartSync).toHaveBeenCalledTimes(1);
  });
});
