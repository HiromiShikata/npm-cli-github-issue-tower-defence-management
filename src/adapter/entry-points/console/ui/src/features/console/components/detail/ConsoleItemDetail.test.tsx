import { render, within } from '@testing-library/react';
import {
  consoleChangedFilesFixture,
  consoleCommentsFixture,
  consoleCommitsFixture,
  consoleListItemsFixture,
  consoleRelatedPullRequestsFixture,
  consoleStatusOptionsFixture,
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
  statusOptions: consoleStatusOptionsFixture,
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

  it('places opened relative time in the sub bar immediately after the repo name', () => {
    const { container } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    const subbar = container.querySelector('.console-detail-subbar');
    const repo = subbar?.querySelector('.console-detail-repo') ?? null;
    const openedAt = subbar?.querySelector('.console-detail-createdat') ?? null;
    if (subbar === null || repo === null || openedAt === null) {
      throw new Error('subbar, repo and openedAt must all render');
    }
    expect(
      repo.compareDocumentPosition(openedAt) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('places labels in the sub bar to the right of the copy URL button', () => {
    const itemWithLabels = consoleListItemsFixture[0];
    expect(itemWithLabels.labels.length).toBeGreaterThan(0);
    const { container } = render(
      <ConsoleItemDetail item={itemWithLabels} {...baseProps} />,
    );
    const subbar = container.querySelector('.console-detail-subbar');
    const copyUrlButton =
      subbar?.querySelector('.console-copy-url-button') ?? null;
    const firstLabelChip = subbar?.querySelector('.console-label-chip') ?? null;
    if (subbar === null || copyUrlButton === null || firstLabelChip === null) {
      throw new Error(
        'subbar, copyUrlButton and firstLabelChip must all render',
      );
    }
    expect(
      copyUrlButton.compareDocumentPosition(firstLabelChip) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders no label chips in the sub bar when the item has no labels', () => {
    const { container } = render(
      <ConsoleItemDetail item={issueItem} {...baseProps} />,
    );
    const subbar = container.querySelector('.console-detail-subbar');
    expect(subbar?.querySelectorAll('.console-label-chip')).toHaveLength(0);
  });

  it('puts the type mark, title text and number in the title line and moves the status chip, story tag and CI state to the row below the title for a pull request item', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        overlayStatus={{ name: 'Awaiting Workspace', color: 'BLUE' }}
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
    const title = container.querySelector('.console-detail-title');
    const subline = container.querySelector('.console-detail-topline');
    if (title === null || subline === null) {
      throw new Error('title and subline must both render');
    }
    expect(title.contains(getByText('Awaiting Workspace'))).toBe(false);
    expect(title.contains(getByText('TDPM Console port'))).toBe(false);
    expect(title.contains(getByText('CI passing'))).toBe(false);
    expect(
      title.compareDocumentPosition(subline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(subline.contains(getByText('Awaiting Workspace'))).toBe(true);
    expect(subline.contains(getByText('TDPM Console port'))).toBe(true);
    expect(subline.contains(getByText('CI passing'))).toBe(true);
  });

  it('title line contains exactly the type mark then title text then number and no other children for a pull request item', () => {
    const { container } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        overlayStatus={{ name: 'Awaiting Workspace', color: 'BLUE' }}
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
    const title = container.querySelector('.console-detail-title');
    if (title === null) {
      throw new Error('title must render');
    }
    expect(title.childElementCount).toBe(3);
    expect(title.children[0]).toHaveClass('console-item-icon');
    expect(title.children[1]).toHaveClass('console-detail-title-text');
    expect(title.children[2]).toHaveClass('console-detail-number');
    expect(title.children[2]).toHaveTextContent(`PR #${prItem.number}`);
  });

  it('title line contains exactly the type mark then title text then number and no other children for a closed task item', () => {
    const { container } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        state={{
          state: 'closed',
          merged: false,
          isPullRequest: false,
          title: '',
        }}
      />,
    );
    const title = container.querySelector('.console-detail-title');
    if (title === null) {
      throw new Error('title must render');
    }
    expect(title.childElementCount).toBe(3);
    expect(title.children[0]).toHaveClass('console-item-icon');
    expect(title.children[1]).toHaveClass('console-detail-title-text');
    expect(title.children[2]).toHaveClass('console-detail-number');
    expect(title.children[2]).toHaveTextContent(`#${issueItem.number}`);
  });

  it('puts CI badges, related pull request groups and conflict chips in the row below the title for a task item with related pull requests', () => {
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
    const title = container.querySelector('.console-detail-title');
    const subline = container.querySelector('.console-detail-topline');
    if (title === null || subline === null) {
      throw new Error('title and subline must both render');
    }
    expect(
      title.compareDocumentPosition(subline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(subline as HTMLElement).getByText('No conflict'),
    ).toBeInTheDocument();
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

  it('renders the overlay status chip in the subline below the title, not inside the title line', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        overlayStatus={{ name: 'Awaiting Workspace', color: 'BLUE' }}
      />,
    );
    const title = container.querySelector('.console-detail-title');
    const subline = container.querySelector('.console-detail-topline');
    expect(title).not.toBeNull();
    expect(subline).not.toBeNull();
    expect(title?.contains(getByText('Awaiting Workspace'))).toBe(false);
    expect(subline?.contains(getByText('Awaiting Workspace'))).toBe(true);
  });

  it('renders the merge conflict state in the subline below the title, not inside the title line', () => {
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
    const title = container.querySelector('.console-detail-title');
    const subline = container.querySelector('.console-detail-topline');
    expect(subline?.contains(getByText('Conflict'))).toBe(true);
    expect(title?.contains(getByText('Conflict'))).toBe(false);
  });

  it('renders the absence of a merge conflict in the subline below the title', () => {
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
    const subline = container.querySelector('.console-detail-topline');
    expect(subline?.contains(getByText('No conflict'))).toBe(true);
  });

  it('renders the related pull request merge state in the subline below the title when the item is an issue', () => {
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
    const subline = container.querySelector('.console-detail-topline');
    expect(
      within(subline as HTMLElement).getByText('No conflict'),
    ).toBeInTheDocument();
  });

  it('renders failing CI, missing checks, and conflict badges in the subline below the title, not inside the title line', () => {
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
      throw new Error('title and subline must both render');
    }
    expect(title.contains(getByText('CI failing'))).toBe(false);
    expect(topline.contains(getByText('CI failing'))).toBe(true);
    expect(topline.contains(getByText('Conflict'))).toBe(true);
    expect(
      title.compareDocumentPosition(topline) & Node.DOCUMENT_POSITION_FOLLOWING,
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

  it('groups each related pull request label with its own CI badge and mergeable chip so two-PR rows are readable', () => {
    const pr849 = consoleRelatedPullRequestsFixture[0];
    const pr850: typeof pr849 = {
      ...pr849,
      url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/850',
      branchName: 'feature/850-other-change',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: false,
      isConflicted: true,
      mergeableStatus: 'CONFLICTING',
      missingRequiredCheckNames: [],
    };
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
        relatedPullRequests={[pr849, pr850].map((pullRequest) => ({
          pullRequest,
          files: [],
          filesAreLoading: false,
          filesError: null,
          commits: [],
          commitsAreLoading: false,
          commitsError: null,
        }))}
      />,
    );
    const groups = container.querySelectorAll('.console-related-pr-group');
    expect(groups).toHaveLength(2);
    const group849 = groups[0];
    const group850 = groups[1];
    expect(
      within(group849 as HTMLElement).getByText('PR #849'),
    ).toBeInTheDocument();
    expect(
      within(group849 as HTMLElement).getByText('CI passing'),
    ).toBeInTheDocument();
    expect(
      within(group849 as HTMLElement).getByText('No conflict'),
    ).toBeInTheDocument();
    expect(
      within(group850 as HTMLElement).getByText('PR #850'),
    ).toBeInTheDocument();
    expect(
      within(group850 as HTMLElement).getByText('CI failing'),
    ).toBeInTheDocument();
    expect(
      within(group850 as HTMLElement).getByText('Conflict'),
    ).toBeInTheDocument();
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

  it('shows the snapshot status chip in the subline below the title when the item has a status and no overlay entry applies', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        overlayStatus={null}
      />,
    );
    const title = container.querySelector('.console-detail-title');
    const subline = container.querySelector('.console-detail-topline');
    expect(title).not.toBeNull();
    expect(subline).not.toBeNull();
    expect(title?.contains(getByText(issueItem.status as string))).toBe(false);
    expect(subline?.contains(getByText(issueItem.status as string))).toBe(true);
  });

  it('shows the overlay status in the subline below the title when the overlay entry is newer than the snapshot', () => {
    const { getByText, queryByText, container } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        overlayStatus={{ name: 'In Progress', color: 'GREEN' }}
      />,
    );
    const title = container.querySelector('.console-detail-title');
    const subline = container.querySelector('.console-detail-topline');
    expect(title).not.toBeNull();
    expect(subline).not.toBeNull();
    expect(title?.contains(getByText('In Progress'))).toBe(false);
    expect(subline?.contains(getByText('In Progress'))).toBe(true);
    expect(queryByText(issueItem.status as string)).toBeNull();
  });

  it('renders no status chip when the item has no status and no overlay applies', () => {
    const noStatusItem = consoleListItemsFixture[3];
    expect(noStatusItem.status).toBeNull();
    const { container } = render(
      <ConsoleItemDetail
        item={noStatusItem}
        {...baseProps}
        overlayStatus={null}
      />,
    );
    const chip = container.querySelector('.console-detail-status-chip');
    expect(chip).toBeNull();
  });

  it('renders the agent chip inside the topline when agent is set', () => {
    const agentItem = { ...issueItem, agent: 'developer' };
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={agentItem}
        {...baseProps}
        overlayStatus={null}
      />,
    );
    const topline = container.querySelector('.console-detail-topline');
    const agentChip = container.querySelector('.console-detail-agent-chip');
    expect(agentChip).not.toBeNull();
    expect(agentChip).toHaveTextContent('developer');
    expect(topline?.contains(getByText('developer'))).toBe(true);
  });

  it('renders no agent chip when agent is null', () => {
    const noAgentItem = { ...issueItem, agent: null };
    const { container } = render(
      <ConsoleItemDetail
        item={noAgentItem}
        {...baseProps}
        overlayStatus={null}
      />,
    );
    const agentChip = container.querySelector('.console-detail-agent-chip');
    expect(agentChip).toBeNull();
  });

  it('groups the title, topline, fetch failures, subbar, labels and createdat inside console-detail-header, with panels outside', () => {
    const { container } = render(
      <ConsoleItemDetail item={issueItem} {...baseProps} />,
    );
    const header = container.querySelector('.console-detail-header');
    expect(header).not.toBeNull();
    expect(header).toContainElement(
      container.querySelector('.console-detail-title'),
    );
    expect(header).toContainElement(
      container.querySelector('.console-detail-topline'),
    );
    expect(header).toContainElement(
      container.querySelector('.console-detail-subbar'),
    );
    expect(header).toContainElement(
      container.querySelector('.console-detail-createdat'),
    );
    const firstPanel = container.querySelector(
      '.console-panel',
    ) as HTMLElement | null;
    expect(header).not.toContainElement(firstPanel);
  });

  it('shows only the item number in the subbar link for an issue, with no Issue prefix', () => {
    const { container } = render(
      <ConsoleItemDetail item={issueItem} {...baseProps} />,
    );
    const link = container.querySelector(
      '.console-detail-subbar .console-detail-link',
    );
    expect(link).not.toBeNull();
    expect(link).toHaveTextContent(`#${issueItem.number}`);
    expect(link?.textContent).not.toContain('Issue');
  });

  it('shows only the item number in the subbar link for a pull request, with no PR prefix', () => {
    const { container } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    const link = container.querySelector(
      '.console-detail-subbar .console-detail-link',
    );
    expect(link).not.toBeNull();
    expect(link).toHaveTextContent(`#${prItem.number}`);
    expect(link?.textContent).not.toContain('PR');
  });

  it('renders no type indicator pill in the subbar', () => {
    const { container } = render(
      <ConsoleItemDetail item={issueItem} {...baseProps} />,
    );
    expect(container.querySelector('.console-detail-pill')).toBeNull();
  });
});
