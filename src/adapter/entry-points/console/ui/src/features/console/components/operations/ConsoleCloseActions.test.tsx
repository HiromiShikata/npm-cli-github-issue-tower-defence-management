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
    const { container } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
      />,
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    const closeIdx = buttons.findIndex((b) => b.textContent === 'Close');
    const commentCloseIdx = buttons.findIndex(
      (b) => b.textContent === 'Comment & Close',
    );
    expect(commentCloseIdx).toBeGreaterThan(closeIdx);
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

  it('disables Comment & Close button when isDraftEmpty is true', () => {
    const { getByText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
        isDraftEmpty={true}
      />,
    );
    expect(getByText('Comment & Close')).toBeDisabled();
  });

  it('enables Comment & Close button when isDraftEmpty is false', () => {
    const { getByText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={async () => {}}
        isDraftEmpty={false}
      />,
    );
    expect(getByText('Comment & Close')).not.toBeDisabled();
  });

  it('disables Comment & Close button while onCommentAndClose is in progress', () => {
    let resolve!: () => void;
    const { getByText } = render(
      <ConsoleCloseActions
        onClose={() => {}}
        onCommentAndClose={() =>
          new Promise<void>((r) => {
            resolve = r;
          })
        }
      />,
    );
    fireEvent.click(getByText('Comment & Close'));
    expect(getByText('Comment & Close')).toBeDisabled();
    resolve();
  });

  it('shows an error alert when onCommentAndClose rejects', async () => {
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
