import { isGitHubIssueOrPullRequestSessionName } from './NotifySilentLiveSessionsUseCase';

describe('isGitHubIssueOrPullRequestSessionName', () => {
  it('accepts the encoded form of a github.com issue URL session name', () => {
    expect(
      isGitHubIssueOrPullRequestSessionName(
        'https_//github_com/HiromiShikata/repo/issues/42',
      ),
    ).toBe(true);
  });

  it('accepts the encoded form of a github.com pull-request URL session name', () => {
    expect(
      isGitHubIssueOrPullRequestSessionName(
        'https_//github_com/HiromiShikata/repo/pull/77',
      ),
    ).toBe(true);
  });

  it('accepts the raw form of a github.com issue and pull-request URL session name', () => {
    expect(
      isGitHubIssueOrPullRequestSessionName(
        'https://github.com/HiromiShikata/repo/issues/42',
      ),
    ).toBe(true);
    expect(
      isGitHubIssueOrPullRequestSessionName(
        'https://github.com/HiromiShikata/repo/pull/77',
      ),
    ).toBe(true);
  });

  it('rejects a plain orchestrator-style session name', () => {
    expect(isGitHubIssueOrPullRequestSessionName('workbench')).toBe(false);
    expect(isGitHubIssueOrPullRequestSessionName('orchestrator')).toBe(false);
    expect(isGitHubIssueOrPullRequestSessionName('aw-host')).toBe(false);
  });

  it('rejects a non-github host even in the encoded form', () => {
    expect(
      isGitHubIssueOrPullRequestSessionName(
        'https_//example_com/HiromiShikata/repo/issues/42',
      ),
    ).toBe(false);
  });

  it('rejects a github.com session name that is neither an issue nor a pull request', () => {
    expect(
      isGitHubIssueOrPullRequestSessionName(
        'https_//github_com/HiromiShikata/repo',
      ),
    ).toBe(false);
    expect(
      isGitHubIssueOrPullRequestSessionName(
        'https_//github_com/HiromiShikata/repo/discussions/42',
      ),
    ).toBe(false);
  });

  it('rejects a github.com issue URL whose trailing segment is not a number', () => {
    expect(
      isGitHubIssueOrPullRequestSessionName(
        'https_//github_com/HiromiShikata/repo/issues/new',
      ),
    ).toBe(false);
  });
});
