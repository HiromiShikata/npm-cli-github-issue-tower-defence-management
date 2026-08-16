import { render, within } from '@testing-library/react';
import {
  consoleChangedFilesFixture,
  consoleCommentsFixture,
  consoleCommitsFixture,
  consoleListItemsFixture,
  consoleRelatedPullRequestsFixture,
} from '../../testing/fixtures';
import { ConsoleItemDetail } from './ConsoleItemDetail';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const now = Date.parse('2026-06-19T12:00:00.000Z');
const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

const baseProps = {
  storyName: 'TDPM Console port',
  storyColorEnum: 'BLUE' as const,
  overlayStatus: null,
  state: { state: 'open', merged: false, isPullRequest: true, title: '' },
  body: '## Body heading',
  bodyIsLoading: false,
  bodyError: null,
  comments: consoleCommentsFixture,
  commentsAreLoading: false,
  commentsError: null,
  files: consoleChangedFilesFixture,
  filesAreLoading: false,
  filesError: null,
  commits: consoleCommitsFixture,
  commitsAreLoading: false,
  commitsError: null,
  pullRequestStatus: null,
  pullRequestStatusError: null,
  relatedPullRequests: [],
  relatedPullRequestsError: null,
  stateError: null,
  now,
  commentComposer: <div>comment-composer</div>,
  operationBar: <div>operation-bar</div>,
};

describe('ConsoleItemDetail', () => {
  it('docks the comment composer with the operation bar so it stays reachable while the body scrolls', () => {
    const { container, getByText } = render(
      <ConsoleItemDetail item={issueItem} {...baseProps} />,
    );
    const dock = container.querySelector('.console-detail-dock');
    expect(dock).not.toBeNull();
    expect(dock).toContainElement(getByText('comment-composer'));
    expect(dock).toContainElement(getByText('operation-bar'));
  });

  it('reports a failed related pull request read on an issue item', () => {
    const { getByRole } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        relatedPullRequestsError="API rate limit already exceeded"
      />,
    );
    expect(getByRole('alert')).toHaveTextContent(
      'Failed to load related pull requests: API rate limit already exceeded',
    );
  });

  it('reports a failed pull request status read on a pull request item', () => {
    const { getByRole } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        pullRequestStatusError="API rate limit already exceeded"
      />,
    );
    expect(getByRole('alert')).toHaveTextContent(
      'Failed to load pull request status: API rate limit already exceeded',
    );
  });

  it('reports a failed item state read', () => {
    const { getByRole } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        stateError="API rate limit already exceeded"
      />,
    );
    expect(getByRole('alert')).toHaveTextContent(
      'Failed to load item state: API rate limit already exceeded',
    );
  });

  it('gathers every failed section read into a single alert', () => {
    const { getAllByRole } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        stateError="API rate limit already exceeded"
        bodyError="API rate limit already exceeded"
        commentsError="API rate limit already exceeded"
      />,
    );
    const alerts = getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(
      'Failed to load item state, description and comments: API rate limit already exceeded',
    );
  });

  it('names a related pull request by its number when its own read failed', () => {
    const { getByRole } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        relatedPullRequests={consoleRelatedPullRequestsFixture.map(
          (pullRequest) => ({
            pullRequest,
            files: [],
            filesAreLoading: false,
            filesError: 'HTTP 502',
            commits: [],
            commitsAreLoading: false,
            commitsError: 'HTTP 502',
          }),
        )}
      />,
    );
    const number = Number.parseInt(
      consoleRelatedPullRequestsFixture[0].url.split('/').slice(-1)[0],
      10,
    );
    expect(getByRole('alert')).toHaveTextContent(
      `Failed to load changed files of PR #${number} and commits of PR #${number}: HTTP 502`,
    );
  });

  it('marks a section whose read failed as not loaded instead of showing it as empty', () => {
    const { getAllByText, queryByText } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        commentsError="API rate limit already exceeded"
      />,
    );
    expect(queryByText('No comments.')).toBeNull();
    expect(getAllByText('Not loaded.').length).toBe(1);
  });

  it('renders the PR title with the PR number, sub bar and counted panels', () => {
    const { getByText, getAllByText } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    expect(getAllByText(`PR #${prItem.number}`).length).toBeGreaterThan(0);
    expect(
      getByText(`Changed files (${consoleChangedFilesFixture.length})`),
    ).toBeInTheDocument();
    expect(
      getByText(`Comments (${consoleCommentsFixture.length})`),
    ).toBeInTheDocument();
    expect(
      getByText(`Commits (${consoleCommitsFixture.length})`),
    ).toBeInTheDocument();
    expect(getByText('operation-bar')).toBeInTheDocument();
    expect(getByText('comment-composer')).toBeInTheDocument();
  });

  it('renders the Description open link to the item url', () => {
    const { getByText } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    const openLink = getByText('open');
    expect(openLink).toHaveAttribute('href', prItem.url);
  });

  it('renders the story tag and opened relative time', () => {
    const { getByText } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    expect(getByText('TDPM Console port')).toBeInTheDocument();
    expect(getByText(/opened/)).toBeInTheDocument();
  });

  it('renders an issue without the changed files or commits panels', () => {
    const { queryByText } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        state={{
          state: 'open',
          merged: false,
          isPullRequest: false,
          title: '',
        }}
      />,
    );
    expect(queryByText('Changed files')).toBeNull();
    expect(queryByText('Commits')).toBeNull();
  });

  it('renders a copy URL button for the item url in the sub bar', () => {
    const { getByRole } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    expect(getByRole('button', { name: 'Copy URL' })).toBeInTheDocument();
  });

  it('renders the overlay status chip when set', () => {
    const { getByText } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        overlayStatus={{ name: 'Awaiting Workspace', color: 'BLUE' }}
      />,
    );
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
  });

  it('renders the overlay status chip inside the title header', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        overlayStatus={{ name: 'Awaiting Workspace', color: 'BLUE' }}
      />,
    );
    const title = container.querySelector('.console-detail-title');
    expect(title).not.toBeNull();
    expect(title?.contains(getByText('Awaiting Workspace'))).toBe(true);
  });

  const firstRowOfDetail = (container: HTMLElement): Element => {
    const detail = container.querySelector('.console-detail');
    const firstRow = detail?.firstElementChild ?? null;
    if (firstRow === null) {
      throw new Error('the item detail must render a first row');
    }
    return firstRow;
  };

  it('renders the merge conflict state on the first row of the detail', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        pullRequestStatus={{
          found: true,
          isConflicted: true,
          mergeableStatus: 'CONFLICTING',
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        }}
      />,
    );
    expect(firstRowOfDetail(container).contains(getByText('Conflict'))).toBe(
      true,
    );
    const title = container.querySelector('.console-detail-title');
    expect(title?.contains(getByText('Conflict'))).toBe(false);
  });

  it('renders the absence of a merge conflict on the first row of the detail', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        pullRequestStatus={{
          found: true,
          isConflicted: false,
          mergeableStatus: 'MERGEABLE',
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        }}
      />,
    );
    expect(firstRowOfDetail(container).contains(getByText('No conflict'))).toBe(
      true,
    );
  });

  it('renders the related pull request merge state on the first row when the item is an issue', () => {
    const { container } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        state={{
          state: 'open',
          merged: false,
          isPullRequest: false,
          title: '',
        }}
        relatedPullRequests={consoleRelatedPullRequestsFixture.map(
          (pullRequest) => ({
            pullRequest,
            files: [],
            filesAreLoading: false,
            filesError: null,
            commits: [],
            commitsAreLoading: false,
            commitsError: null,
          }),
        )}
      />,
    );
    expect(
      within(firstRowOfDetail(container) as HTMLElement).getByText(
        'No conflict',
      ),
    ).toBeInTheDocument();
  });

  it('renders failing CI, missing checks, and conflict badges on the top line above the title', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        pullRequestStatus={{
          found: true,
          isConflicted: true,
          mergeableStatus: 'CONFLICTING',
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isBranchOutOfDate: true,
          missingRequiredCheckNames: ['build', 'test'],
        }}
      />,
    );
    const title = container.querySelector('.console-detail-title');
    const topline = container.querySelector('.console-detail-topline');
    if (title === null || topline === null) {
      throw new Error('title and top line must both render');
    }
    expect(title.contains(getByText('CI failing'))).toBe(false);
    expect(topline.contains(getByText('CI failing'))).toBe(true);
    expect(topline.contains(getByText('Conflict'))).toBe(true);
    expect(
      topline.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(getByText(/missing: build, test/)).toBeInTheDocument();
    expect(getByText('Conflict')).toBeInTheDocument();
    expect(getByText('Out of date')).toBeInTheDocument();
  });

  it('renders a passing CI badge and no conflict badge when the PR is healthy', () => {
    const { getByText, queryByText } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        pullRequestStatus={{
          found: true,
          isConflicted: false,
          mergeableStatus: 'MERGEABLE',
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        }}
      />,
    );
    expect(getByText('CI passing')).toBeInTheDocument();
    expect(getByText('No conflict')).toBeInTheDocument();
    expect(queryByText('Out of date')).toBeNull();
  });

  it('does not render PR status badges for an issue item', () => {
    const { queryByText } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        state={{
          state: 'open',
          merged: false,
          isPullRequest: false,
          title: '',
        }}
        pullRequestStatus={null}
      />,
    );
    expect(queryByText('CI passing')).toBeNull();
    expect(queryByText('CI failing')).toBeNull();
  });

  it('renders the CI badge for a linked pull request inside .console-detail-topline when the item is an issue', () => {
    const { container } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        state={{
          state: 'open',
          merged: false,
          isPullRequest: false,
          title: '',
        }}
        relatedPullRequests={[
          {
            pullRequest: {
              ...consoleRelatedPullRequestsFixture[0],
              isPassedAllCiJob: false,
              isCiStateSuccess: false,
              isBranchOutOfDate: true,
              missingRequiredCheckNames: ['ci'],
            },
            files: [],
            filesAreLoading: false,
            filesError: null,
            commits: [],
            commitsAreLoading: false,
            commitsError: null,
          },
        ]}
      />,
    );
    const topline = container.querySelector('.console-detail-topline');
    expect(topline).not.toBeNull();
    expect(
      within(topline as HTMLElement).getByText('CI failing'),
    ).toBeInTheDocument();
  });
});
