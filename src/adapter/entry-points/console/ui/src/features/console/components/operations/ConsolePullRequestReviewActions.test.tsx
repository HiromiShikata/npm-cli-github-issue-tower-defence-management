import { fireEvent, render } from '@testing-library/react';
import { ConsolePullRequestReviewActions } from './ConsolePullRequestReviewActions';

describe('ConsolePullRequestReviewActions', () => {
  it('renders the four buttons left to right', () => {
    const { getAllByRole } = render(
      <ConsolePullRequestReviewActions
        onReview={() => {}}
        rejectEnabled={false}
      />,
    );
    expect(getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Unnecessary',
      'Totally wrong',
      'Reject',
      'Approve',
    ]);
  });

  it('disables Reject until an inline comment has been entered', () => {
    const { getByText, rerender } = render(
      <ConsolePullRequestReviewActions
        onReview={() => {}}
        rejectEnabled={false}
      />,
    );
    expect(getByText('Reject')).toBeDisabled();
    expect(getByText('Approve')).not.toBeDisabled();
    rerender(
      <ConsolePullRequestReviewActions
        onReview={() => {}}
        rejectEnabled={true}
      />,
    );
    expect(getByText('Reject')).not.toBeDisabled();
  });

  it('does not report a reject action while disabled', () => {
    const onReview = jest.fn();
    const { getByText } = render(
      <ConsolePullRequestReviewActions
        onReview={onReview}
        rejectEnabled={false}
      />,
    );
    fireEvent.click(getByText('Reject'));
    expect(onReview).not.toHaveBeenCalled();
  });

  it('reports each review action when reject is enabled', () => {
    const onReview = jest.fn();
    const { getByText } = render(
      <ConsolePullRequestReviewActions
        onReview={onReview}
        rejectEnabled={true}
      />,
    );
    fireEvent.click(getByText('Unnecessary'));
    fireEvent.click(getByText('Totally wrong'));
    fireEvent.click(getByText('Reject'));
    fireEvent.click(getByText('Approve'));
    expect(onReview.mock.calls.map((call) => call[0])).toEqual([
      'unnecessary',
      'totally_wrong',
      'request_changes',
      'approve',
    ]);
  });
});
