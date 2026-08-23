import { render, waitFor } from '@testing-library/react';
import { parseGitHubReferenceUrl } from '../../logic/references';
import {
  consoleChangedFilesFixture,
  consoleCommitsFixture,
  consoleRelatedPullRequestsFixture,
} from '../../testing/fixtures';
import { ConsolePullRequestDetail } from './ConsolePullRequestDetail';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const now = Date.parse('2026-06-19T12:00:00.000Z');
const pullRequest = consoleRelatedPullRequestsFixture[0];
const pullRequestReference = parseGitHubReferenceUrl(pullRequest.url);

if (pullRequestReference === null) {
  throw new Error('the fixture pull request url must be a GitHub url');
}

describe('ConsolePullRequestDetail', () => {
  it('renders the title, stat bar and changed files', () => {
    const { getByText } = render(
      <ConsolePullRequestDetail
        pullRequest={pullRequest}
        body={pullRequest.summary?.body ?? ''}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
      />,
    );
    expect(
      getByText(
        'Scaffold React console UI under entry-points with build bundling',
      ),
    ).toBeInTheDocument();
    expect(getByText('+1184')).toBeInTheDocument();
    expect(getByText('27 files')).toBeInTheDocument();
    expect(
      getByText(
        `${pullRequestReference.owner}/${pullRequestReference.repo}`,
      ),
    ).toBeInTheDocument();
  });

  it('renders the CI status badge derived from the pull request fields', () => {
    const { getByText } = render(
      <ConsolePullRequestDetail
        pullRequest={pullRequest}
        body={pullRequest.summary?.body ?? ''}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
      />,
    );
    expect(getByText('CI passing')).toBeInTheDocument();
  });

  it('renders failing CI, conflict and out-of-date badges for an unhealthy pull request', () => {
    const { getByText } = render(
      <ConsolePullRequestDetail
        pullRequest={{
          ...pullRequest,
          isConflicted: true,
          mergeableStatus: 'CONFLICTING',
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isBranchOutOfDate: true,
          missingRequiredCheckNames: ['build'],
        }}
        body={pullRequest.summary?.body ?? ''}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
      />,
    );
    expect(getByText('CI failing')).toBeInTheDocument();
    expect(getByText(/missing: build/)).toBeInTheDocument();
    expect(getByText('Conflict')).toBeInTheDocument();
    expect(getByText('Out of date')).toBeInTheDocument();
  });

  it('opens the description panel when the view is first rendered', () => {
    const { getByRole } = render(
      <ConsolePullRequestDetail
        pullRequest={pullRequest}
        body={pullRequest.summary?.body ?? ''}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
      />,
    );
    expect(getByRole('button', { name: /^▾ Description$/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('renders an issue reference in the description against the repository owning the pull request', async () => {
    const referencedIssueNumber = 1234;
    const renderReferenceLink = jest.fn((href: string) => (
      <span className="decorated-reference" data-href={href}>
        decorated
      </span>
    ));
    const { container } = render(
      <ConsolePullRequestDetail
        pullRequest={{
          ...pullRequest,
          summary:
            pullRequest.summary === null
              ? null
              : {
                  ...pullRequest.summary,
                  body: `- close #${referencedIssueNumber}`,
                },
        }}
        body={`- close #${referencedIssueNumber}`}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
        renderReferenceLink={renderReferenceLink}
      />,
    );
    await waitFor(() => {
      expect(container.querySelectorAll('.decorated-reference').length).toBe(1);
    });
    expect(
      container
        .querySelector('.decorated-reference')
        ?.getAttribute('data-href'),
    ).toBe(
      `https://github.com/${pullRequestReference.owner}/${pullRequestReference.repo}/issues/${referencedIssueNumber}`,
    );
  });

  it('leaves an issue reference untouched when the pull request url names no repository', async () => {
    const renderReferenceLink = jest.fn((href: string) => (
      <span className="decorated-reference" data-href={href}>
        decorated
      </span>
    ));
    const { container } = render(
      <ConsolePullRequestDetail
        pullRequest={{
          ...pullRequest,
          url: 'https://example.com/not-a-github-pull-request',
          summary:
            pullRequest.summary === null
              ? null
              : { ...pullRequest.summary, body: '- close #1234' },
        }}
        body={'- close #1234'}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
        renderReferenceLink={renderReferenceLink}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector('.console-markdown')).not.toBeNull();
    });
    expect(container.querySelector('.decorated-reference')).toBeNull();
    expect(renderReferenceLink).not.toHaveBeenCalled();
  });

  it('renders a copy URL button for the pull request url', () => {
    const { getByRole } = render(
      <ConsolePullRequestDetail
        pullRequest={pullRequest}
        body={pullRequest.summary?.body ?? ''}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
      />,
    );
    expect(getByRole('button', { name: 'Copy PR URL' })).toBeInTheDocument();
  });

  it('offers a link painted as a link that opens the pull request', () => {
    const { getByRole } = render(
      <ConsolePullRequestDetail
        pullRequest={pullRequest}
        body={pullRequest.summary?.body ?? ''}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
      />,
    );

    const openLink = getByRole('link', { name: 'open' });
    expect(openLink).toHaveAttribute('href', pullRequest.url);
    expect(openLink).toHaveAttribute('target', '_blank');
    expect(openLink.className).toContain('console-panel-open-link');
  });
});
