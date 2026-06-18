import { render, screen } from '@testing-library/react';
import {
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../fixtures';
import { ConsoleOperationBar } from './ConsoleOperationBar';

const handlers = {
  onReview: () => undefined,
  onSnooze: () => undefined,
  onSetStory: () => undefined,
  onSetStatus: () => undefined,
  onSetInTmux: () => undefined,
  onClose: () => undefined,
};

describe('ConsoleOperationBar', () => {
  it('shows the review group only when a review target exists', () => {
    const { rerender } = render(
      <ConsoleOperationBar
        tab="prs"
        isPr
        hasReviewTarget
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        {...handlers}
      />,
    );
    expect(screen.getByText('Approve')).toBeInTheDocument();
    rerender(
      <ConsoleOperationBar
        tab="unread"
        isPr={false}
        hasReviewTarget={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        {...handlers}
      />,
    );
    expect(screen.queryByText('Approve')).toBeNull();
  });

  it('shows the story group only on the triage tab', () => {
    const { rerender } = render(
      <ConsoleOperationBar
        tab="triage"
        isPr={false}
        hasReviewTarget={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        {...handlers}
      />,
    );
    expect(screen.getByText('TDPM Console port')).toBeInTheDocument();
    rerender(
      <ConsoleOperationBar
        tab="prs"
        isPr={false}
        hasReviewTarget={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        {...handlers}
      />,
    );
    expect(screen.queryByText('TDPM Console port')).toBeNull();
  });

  it('hides the close group for pull request items', () => {
    render(
      <ConsoleOperationBar
        tab="prs"
        isPr
        hasReviewTarget
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        {...handlers}
      />,
    );
    expect(screen.queryByText('Close as not planned')).toBeNull();
  });

  it('renders the status group on every tab', () => {
    render(
      <ConsoleOperationBar
        tab="failed-preparation"
        isPr={false}
        hasReviewTarget={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        {...handlers}
      />,
    );
    expect(screen.getByText('Awaiting Workspace')).toBeInTheDocument();
  });
});
