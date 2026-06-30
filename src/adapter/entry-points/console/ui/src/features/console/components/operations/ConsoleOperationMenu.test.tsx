import { render } from '@testing-library/react';
import type { ConsoleOperationHandlers } from '../../logic/operations';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleOperationMenu } from './ConsoleOperationMenu';

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

describe('ConsoleOperationMenu', () => {
  it('shows the review and close groups for a PR while hiding the story group outside triage', () => {
    const { getByText, queryByText } = render(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Approve')).toBeInTheDocument();
    expect(getByText('+1 day')).toBeInTheDocument();
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
    expect(getByText('Close')).toBeInTheDocument();
    expect(getByText('Close as not planned')).toBeInTheDocument();
    expect(queryByText('Move to Okinawa')).toBeNull();
    expect(queryByText('TDPM Console port')).toBeNull();
  });

  it('shows the story group on the triage tab and the close group for an issue', () => {
    const { getByText } = render(
      <ConsoleOperationMenu
        tab="triage"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
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
      <ConsoleOperationMenu
        tab="todo-by-human"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('+1 week and skip')).toBeInTheDocument();
  });

  it('hides the review group when there is no pull request', () => {
    const { queryByText } = render(
      <ConsoleOperationMenu
        tab="unread"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(queryByText('Approve')).toBeNull();
    expect(queryByText('Close')).not.toBeNull();
  });

  it('shows status, close and next-action groups but hides the story group on the workflow-blocker tab', () => {
    const { getByText, queryByText } = render(
      <ConsoleOperationMenu
        tab="workflow-blocker"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
    expect(getByText('Close')).toBeInTheDocument();
    expect(getByText('Close as not planned')).toBeInTheDocument();
    expect(getByText('+1 day')).toBeInTheDocument();
    expect(queryByText('Move to Okinawa')).toBeNull();
    expect(queryByText('Approve')).toBeNull();
  });

  it('shows the review group on the workflow-blocker tab when the item has a pull request', () => {
    const { getByText } = render(
      <ConsoleOperationMenu
        tab="workflow-blocker"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Approve')).toBeInTheDocument();
    expect(getByText('Close')).toBeInTheDocument();
  });

  it('forwards the reject-enabled state to the review group', () => {
    const { getByText, rerender } = render(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Reject')).toBeDisabled();
    rerender(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={true}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Reject')).not.toBeDisabled();
  });
});
