import { fireEvent, render, waitFor } from '@testing-library/react';
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

  it('does not render the Comment & Close button when onCommentAndClose is not provided', () => {
    const { queryByText } = render(<ConsoleCloseActions onClose={() => {}} />);
    expect(queryByText('Comment & Close')).toBeNull();
  });

  it('renders the Comment & Close button when onCommentAndClose is provided', () => {
    const { getByText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
      />,
    );
    expect(getByText('Comment & Close')).toBeInTheDocument();
  });

  it('shows the inline form when Comment & Close is clicked', () => {
    const { getByText, getByPlaceholderText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    expect(getByPlaceholderText('Leave a comment…')).toBeInTheDocument();
    expect(getByText('Submit')).toBeInTheDocument();
  });

  it('hides the inline form when Comment & Close is clicked a second time', () => {
    const { getByText, queryByPlaceholderText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    fireEvent.click(getByText('Comment & Close'));
    expect(queryByPlaceholderText('Leave a comment…')).toBeNull();
  });

  it('disables the Submit button when the draft is empty', () => {
    const { getByText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    expect(getByText('Submit')).toBeDisabled();
  });

  it('enables the Submit button when the draft has content', () => {
    const { getByText, getByPlaceholderText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'closing note' },
    });
    expect(getByText('Submit')).not.toBeDisabled();
  });

  it('calls onCommentAndClose with the typed body and collapses the form on success', async () => {
    const onCommentAndClose = jest.fn(async () => {});
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={onCommentAndClose}
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'closing note' },
    });
    fireEvent.click(getByText('Submit'));
    await waitFor(() => {
      expect(queryByPlaceholderText('Leave a comment…')).toBeNull();
    });
    expect(onCommentAndClose).toHaveBeenCalledWith('closing note');
  });

  it('shows an error and keeps the form open when onCommentAndClose rejects', async () => {
    const { getByText, getByPlaceholderText, findByRole } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {
          throw new Error('network error');
        }}
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'closing note' },
    });
    fireEvent.click(getByText('Submit'));
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('network error');
    expect(getByPlaceholderText('Leave a comment…')).toBeInTheDocument();
  });
});
