import { fireEvent, render } from '@testing-library/react';
import { ConsoleCloseActions } from './ConsoleCloseActions';

describe('ConsoleCloseActions', () => {
  it('renders both close buttons', () => {
    const { getByText } = render(<ConsoleCloseActions onClose={() => {}} />);
    expect(getByText('Close')).toBeInTheDocument();
    expect(getByText('Close as not planned')).toBeInTheDocument();
  });

  it('reports the close actions', () => {
    const onClose = jest.fn();
    const { getByText } = render(<ConsoleCloseActions onClose={onClose} />);
    fireEvent.click(getByText('Close'));
    fireEvent.click(getByText('Close as not planned'));
    expect(onClose.mock.calls.map((call) => call[0])).toEqual([
      'close',
      'close_not_planned',
    ]);
  });

  it('does not render Comment & Close button when onCommentAndClose is not provided', () => {
    const { queryByText } = render(<ConsoleCloseActions onClose={() => {}} />);
    expect(queryByText('Comment & Close')).toBeNull();
  });

  it('renders Comment & Close button to the right of Close when onCommentAndClose is provided', () => {
    const { getByText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
      />,
    );
    expect(getByText('Comment & Close')).toBeInTheDocument();
  });

  it('calls onCommentAndClose when Comment & Close is clicked', () => {
    const onCommentAndClose = jest.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={onCommentAndClose}
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    expect(onCommentAndClose).toHaveBeenCalledTimes(1);
  });

  it('shows an error alert and disables the button while posting when onCommentAndClose rejects', async () => {
    const { getByText, findByRole } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {
          throw new Error('network error');
        }}
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('network error');
  });
});
