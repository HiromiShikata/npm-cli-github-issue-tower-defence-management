import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsoleCloseButtonGroup } from './ConsoleCloseButtonGroup';

describe('ConsoleCloseButtonGroup', () => {
  it('renders both close buttons', () => {
    render(<ConsoleCloseButtonGroup onClose={() => undefined} />);
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('Close as not planned')).toBeInTheDocument();
  });

  it('maps each button to its close event', async () => {
    const onClose = jest.fn();
    render(<ConsoleCloseButtonGroup onClose={onClose} />);
    await userEvent.click(screen.getByText('Close'));
    await userEvent.click(screen.getByText('Close as not planned'));
    expect(onClose.mock.calls.map((call) => call[0])).toEqual([
      'close',
      'close_not_planned',
    ]);
  });
});
