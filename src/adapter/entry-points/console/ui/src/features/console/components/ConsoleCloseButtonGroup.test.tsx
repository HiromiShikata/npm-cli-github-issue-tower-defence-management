import { fireEvent, render } from '@testing-library/react';
import { ConsoleCloseButtonGroup } from './ConsoleCloseButtonGroup';

describe('ConsoleCloseButtonGroup', () => {
  it('renders both close buttons', () => {
    const { getByText } = render(
      <ConsoleCloseButtonGroup onClose={() => {}} />,
    );
    expect(getByText('Close')).toBeInTheDocument();
    expect(getByText('Close as not planned')).toBeInTheDocument();
  });

  it('reports the close actions', () => {
    const onClose = jest.fn();
    const { getByText } = render(<ConsoleCloseButtonGroup onClose={onClose} />);
    fireEvent.click(getByText('Close'));
    fireEvent.click(getByText('Close as not planned'));
    expect(onClose.mock.calls.map((call) => call[0])).toEqual([
      'close',
      'close_not_planned',
    ]);
  });
});
