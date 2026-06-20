import { render } from '@testing-library/react';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../fixtures';
import type { ConsoleOperationHandlers } from '../operations';
import { ConsoleOperationBar } from './ConsoleOperationBar';

const handlers: ConsoleOperationHandlers = {
  onReview: jest.fn(),
  onSetNextActionDate: jest.fn(),
  onSetStory: jest.fn(),
  onSetStatus: jest.fn(),
  onSetInTmuxByHuman: jest.fn(),
  onClose: jest.fn(),
};

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

describe('ConsoleOperationBar', () => {
  it('shows the review group for a PR and hides story and close groups outside triage', () => {
    const { getByText, queryByText } = render(
      <ConsoleOperationBar
        tab="prs"
        item={prItem}
        hasPullRequest
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Approve')).toBeInTheDocument();
    expect(getByText('+1 day')).toBeInTheDocument();
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
    expect(queryByText('Close')).toBeNull();
    expect(queryByText('TDPM Console port')).toBeNull();
  });

  it('shows the story group on the triage tab and the close group for an issue', () => {
    const { getByText } = render(
      <ConsoleOperationBar
        tab="triage"
        item={issueItem}
        hasPullRequest={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Move to Okinawa')).toBeInTheDocument();
    expect(getByText('Close')).toBeInTheDocument();
    expect(getByText('Close as not planned')).toBeInTheDocument();
  });

  it('shows +1 week and skip on the todo-by-human tab', () => {
    const { getByText } = render(
      <ConsoleOperationBar
        tab="todo-by-human"
        item={issueItem}
        hasPullRequest={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('+1 week and skip')).toBeInTheDocument();
  });

  it('hides the review group when there is no pull request', () => {
    const { queryByText } = render(
      <ConsoleOperationBar
        tab="unread"
        item={issueItem}
        hasPullRequest={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(queryByText('Approve')).toBeNull();
    expect(queryByText('Close')).not.toBeNull();
  });
});
