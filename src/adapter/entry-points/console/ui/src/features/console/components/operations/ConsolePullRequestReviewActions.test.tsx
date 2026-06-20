import { fireEvent, render } from '@testing-library/react';
import { ConsolePullRequestReviewActions } from './ConsolePullRequestReviewActions';

describe('ConsolePullRequestReviewActions', () => {
  it('renders the four buttons left to right', () => {
    const { getAllByRole } = render(
      <ConsolePullRequestReviewActions onReview={() => {}} />,
    );
    expect(getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Unnecessary',
      'Totally wrong',
      'Reject',
      'Approve',
    ]);
  });

  it('reports each review action', () => {
    const onReview = jest.fn();
    const { getByText } = render(
      <ConsolePullRequestReviewActions onReview={onReview} />,
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
