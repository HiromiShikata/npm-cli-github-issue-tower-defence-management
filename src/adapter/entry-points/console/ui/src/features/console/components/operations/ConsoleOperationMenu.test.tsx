import { fireEvent, render } from '@testing-library/react';
import type { ConsoleOperationHandlers } from '../../logic/operations';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleOperationMenu } from './ConsoleOperationMenu';

const handlers: ConsoleOperationHandlers = {
  onReview: jest.fn(),
  onSetNextActionDate: jest.fn(),
  onSetStory: jest.fn(),
  onSetStatus: jest.fn(),
  onSetInTmuxByHuman: jest.fn(),
  onClose: jest.fn(),
  onOkAndAwaitingWorkspace: jest.fn(),
  onDeleteAllComments: jest.fn(),
  onDeleteStory: null,
  onSetDependedIssueUrl: jest.fn(),
};

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

describe('ConsoleOperationMenu', () => {
  it('shows the review and close groups for a PR on the prs tab', () => {
    const { getByText, queryByText } = render(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Approve & Merge')).toBeInTheDocument();
    expect(getByText('+1 day')).toBeInTheDocument();
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
    expect(getByText('Close')).toBeInTheDocument();
    expect(getByText('Close as not planned')).toBeInTheDocument();
    expect(queryByText('Move to Okinawa')).toBeNull();
    expect(queryByText('TDPM Console port')).toBeNull();
  });

  it('shows +1 week and skip on the todo-by-human tab', () => {
    const { getByText } = render(
      <ConsoleOperationMenu
        tab="todo-by-human"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('+1 week and skip')).toBeInTheDocument();
  });

  it('shows +1 week and skip on the todo-by-agent tab', () => {
    const { getByText } = render(
      <ConsoleOperationMenu
        tab="todo-by-agent"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('+1 week and skip')).toBeInTheDocument();
  });

  it('hides the review group when there is no pull request', () => {
    const { queryByText } = render(
      <ConsoleOperationMenu
        tab="todo-by-human"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(queryByText('Approve & Merge')).toBeNull();
    expect(queryByText('Close')).not.toBeNull();
  });

  it('shows status, close and next-action groups on the workflow-blocker tab', () => {
    const { getByText, queryByText } = render(
      <ConsoleOperationMenu
        tab="workflow-blocker"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
    expect(getByText('Close')).toBeInTheDocument();
    expect(getByText('Close as not planned')).toBeInTheDocument();
    expect(getByText('+1 day')).toBeInTheDocument();
    expect(queryByText('Move to Okinawa')).toBeNull();
    expect(queryByText('Approve & Merge')).toBeNull();
  });

  it('shows the review group on the workflow-blocker tab when the item has a pull request', () => {
    const { getByText } = render(
      <ConsoleOperationMenu
        tab="workflow-blocker"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('Approve & Merge')).toBeInTheDocument();
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
        handlers={handlers}
      />,
    );
    expect(getByText('Reject')).not.toBeDisabled();
  });

  it('renders the dangerous actions toggle on all tabs', () => {
    const { getByText } = render(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByText('⚠')).toBeInTheDocument();
  });

  it('renders the dangerous actions toggle in the same row as close actions', () => {
    const { getByText } = render(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    const dangerButton = getByText('⚠');
    const closeButton = getByText('Close');
    const dangerRow = dangerButton.closest('.console-op-group-bottom-row');
    expect(dangerRow).not.toBeNull();
    expect(dangerRow).toBe(closeButton.closest('.console-op-group-bottom-row'));
  });

  it('renders the rare actions toggle on all tabs', () => {
    const { getByTitle } = render(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    expect(getByTitle('Rare actions')).toBeInTheDocument();
  });

  it('renders the rare actions toggle in the same row as dangerous and close actions', () => {
    const { getByTitle, getByText } = render(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    const rareButton = getByTitle('Rare actions');
    const closeButton = getByText('Close');
    const rareRow = rareButton.closest('.console-op-group-bottom-row');
    expect(rareRow).not.toBeNull();
    expect(rareRow).toBe(closeButton.closest('.console-op-group-bottom-row'));
  });

  it('renders the rare actions toggle in the left pair alongside the dangerous actions toggle', () => {
    const { getByTitle, getByText } = render(
      <ConsoleOperationMenu
        tab="prs"
        item={prItem}
        hasPullRequest
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    const rareButton = getByTitle('Rare actions');
    const dangerButton = getByText('⚠');
    const leftPair = rareButton.closest('.console-op-group-left-pair');
    expect(leftPair).not.toBeNull();
    expect(leftPair).toBe(dangerButton.closest('.console-op-group-left-pair'));
  });

  it('shows Delete Story button when onDeleteStory handler is provided', () => {
    const { getByText } = render(
      <ConsoleOperationMenu
        tab="todo-by-human"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={{ ...handlers, onDeleteStory: async () => {} }}
      />,
    );
    fireEvent.click(getByText('⚠'));
    expect(getByText('Delete Story')).toBeInTheDocument();
  });

  it('does not show Delete Story button when onDeleteStory handler is null', () => {
    const { getByText, queryByText } = render(
      <ConsoleOperationMenu
        tab="todo-by-human"
        item={issueItem}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        handlers={handlers}
      />,
    );
    fireEvent.click(getByText('⚠'));
    expect(queryByText('Delete Story')).toBeNull();
  });
});
