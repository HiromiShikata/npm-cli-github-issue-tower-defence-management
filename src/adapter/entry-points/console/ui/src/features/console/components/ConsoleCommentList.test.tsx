import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { consoleCommentsFixture } from '../fixtures';
import { ConsoleCommentList } from './ConsoleCommentList';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(async () => ({ svg: '<svg></svg>' })),
  },
}));

describe('ConsoleCommentList', () => {
  it('shows only the latest comment by default and toggles to show all', async () => {
    render(
      <ConsoleCommentList
        comments={consoleCommentsFixture}
        isLoading={false}
        error={null}
      />,
    );
    expect(
      screen.getByText('Showing latest comment only (of 2)'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText('Show all 2 comments'));
    expect(screen.getByText('Show latest only')).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    render(<ConsoleCommentList comments={[]} isLoading error={null} />);
    expect(screen.getByText('Loading comments…')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    render(<ConsoleCommentList comments={[]} isLoading={false} error={null} />);
    expect(screen.getByText('(no comments)')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    render(
      <ConsoleCommentList comments={[]} isLoading={false} error="HTTP 500" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 500');
  });
});
