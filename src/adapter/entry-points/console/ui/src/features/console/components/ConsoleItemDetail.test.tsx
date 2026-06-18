import { render, screen } from '@testing-library/react';
import {
  consoleCommentsFixture,
  consoleListItemsFixture,
  consoleMarkdownBodyFixture,
  consolePullRequestDetailFixture,
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../fixtures';
import { ConsoleItemDetail } from './ConsoleItemDetail';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(async () => ({ svg: '<svg></svg>' })),
  },
}));

const baseProps = {
  statusOptions: consoleStatusOptionsFixture,
  storyOptions: consoleStoryOptionsFixture,
  onReview: () => undefined,
  onSnooze: () => undefined,
  onSetStory: () => undefined,
  onSetStatus: () => undefined,
  onSetInTmux: () => undefined,
  onClose: () => undefined,
};

describe('ConsoleItemDetail', () => {
  it('renders the body, comments, and PR section for a pull request item', () => {
    render(
      <ConsoleItemDetail
        tab="prs"
        item={consoleListItemsFixture[0]}
        body={consoleMarkdownBodyFixture}
        isBodyLoading={false}
        bodyError={null}
        comments={consoleCommentsFixture}
        areCommentsLoading={false}
        commentsError={null}
        pullRequestDetail={consolePullRequestDetailFixture}
        relatedPullRequests={[]}
        isPullRequestLoading={false}
        pullRequestError={null}
        {...baseProps}
      />,
    );
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
  });

  it('shows the body loading state', () => {
    render(
      <ConsoleItemDetail
        tab="unread"
        item={consoleListItemsFixture[2]}
        body=""
        isBodyLoading
        bodyError={null}
        comments={[]}
        areCommentsLoading
        commentsError={null}
        pullRequestDetail={null}
        relatedPullRequests={[]}
        isPullRequestLoading={false}
        pullRequestError={null}
        {...baseProps}
      />,
    );
    expect(screen.getByText('Loading body…')).toBeInTheDocument();
  });

  it('omits the PR section for a task item without a review target', () => {
    render(
      <ConsoleItemDetail
        tab="unread"
        item={consoleListItemsFixture[2]}
        body="body"
        isBodyLoading={false}
        bodyError={null}
        comments={[]}
        areCommentsLoading={false}
        commentsError={null}
        pullRequestDetail={null}
        relatedPullRequests={[]}
        isPullRequestLoading={false}
        pullRequestError={null}
        {...baseProps}
      />,
    );
    expect(screen.queryByText('Approve')).toBeNull();
    expect(screen.getByText('Close as not planned')).toBeInTheDocument();
  });
});
