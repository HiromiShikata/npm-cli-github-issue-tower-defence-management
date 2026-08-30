import { render, screen } from '@testing-library/react';
import { ConsoleProjectTimerBar } from './ConsoleProjectTimerBar';

const ENDS_AT = '2026-08-30T10:30:00.000Z';
const ENDS_AT_MS = new Date(ENDS_AT).getTime();
const TOTAL_SECONDS = 1800;

describe('ConsoleProjectTimerBar', () => {
  it('renders nothing when timerEndsAt is null', () => {
    const { container } = render(
      <ConsoleProjectTimerBar
        timerEndsAt={null}
        timerTotalSeconds={TOTAL_SECONDS}
        now={ENDS_AT_MS - TOTAL_SECONDS * 1000}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when timerTotalSeconds is null', () => {
    const { container } = render(
      <ConsoleProjectTimerBar
        timerEndsAt={ENDS_AT}
        timerTotalSeconds={null}
        now={ENDS_AT_MS - TOTAL_SECONDS * 1000}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows remaining time when timer has not expired', () => {
    const nowMs = ENDS_AT_MS - 900 * 1000;
    render(
      <ConsoleProjectTimerBar
        timerEndsAt={ENDS_AT}
        timerTotalSeconds={TOTAL_SECONDS}
        now={nowMs}
      />,
    );
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('shows Move to next project message when timer has expired', () => {
    const nowMs = ENDS_AT_MS + 5000;
    render(
      <ConsoleProjectTimerBar
        timerEndsAt={ENDS_AT}
        timerTotalSeconds={TOTAL_SECONDS}
        now={nowMs}
      />,
    );
    expect(screen.getByText('Move to next project')).toBeInTheDocument();
  });

  it('renders a progressbar with correct aria attributes', () => {
    const nowMs = ENDS_AT_MS - 900 * 1000;
    render(
      <ConsoleProjectTimerBar
        timerEndsAt={ENDS_AT}
        timerTotalSeconds={TOTAL_SECONDS}
        now={nowMs}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '900');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '1800');
  });

  it('shows HH:MM:SS format when remaining time exceeds one hour', () => {
    const endsAt = '2026-08-30T12:00:00.000Z';
    const endsAtMs = new Date(endsAt).getTime();
    const nowMs = endsAtMs - 7200 * 1000;
    render(
      <ConsoleProjectTimerBar
        timerEndsAt={endsAt}
        timerTotalSeconds={7200}
        now={nowMs}
      />,
    );
    expect(screen.getByText('2:00:00')).toBeInTheDocument();
  });
});
