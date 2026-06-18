import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsolePullRequestReviewGroup } from './ConsolePullRequestReviewGroup';

describe('ConsolePullRequestReviewGroup', () => {
  it('renders the four review buttons in prototype order', () => {
    render(<ConsolePullRequestReviewGroup onReview={() => undefined} />);
    const labels = screen
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labels).toEqual([
      'Unnecessary',
      'Totally wrong',
      'Reject',
      'Approve',
    ]);
  });

  it('maps each button to its review event', async () => {
    const onReview = jest.fn();
    render(<ConsolePullRequestReviewGroup onReview={onReview} />);
    await userEvent.click(screen.getByText('Approve'));
    await userEvent.click(screen.getByText('Reject'));
    await userEvent.click(screen.getByText('Unnecessary'));
    await userEvent.click(screen.getByText('Totally wrong'));
    expect(onReview.mock.calls.map((call) => call[0])).toEqual([
      'APPROVE',
      'REQUEST_CHANGES',
      'CLOSE_UNNEEDED',
      'CLOSE_WRONG',
    ]);
  });
});
