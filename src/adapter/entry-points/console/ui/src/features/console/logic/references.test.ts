import {
  parseGitHubReferenceUrl,
  referenceStateToIconInput,
} from './references';

describe('parseGitHubReferenceUrl', () => {
  it('parses an issue url', () => {
    expect(
      parseGitHubReferenceUrl('https://github.com/octo/repo/issues/42'),
    ).toEqual({ owner: 'octo', repo: 'repo', number: 42, kind: 'issue' });
  });

  it('parses a pull request url', () => {
    expect(
      parseGitHubReferenceUrl('https://github.com/octo/repo/pull/7'),
    ).toEqual({ owner: 'octo', repo: 'repo', number: 7, kind: 'pull' });
  });

  it('parses a url with a trailing hash fragment', () => {
    expect(
      parseGitHubReferenceUrl(
        'https://github.com/octo/repo/issues/42#issuecomment-1',
      ),
    ).toEqual({ owner: 'octo', repo: 'repo', number: 42, kind: 'issue' });
  });

  it('returns null for a non-issue github url', () => {
    expect(
      parseGitHubReferenceUrl('https://github.com/octo/repo/blob/main/file.ts'),
    ).toBeNull();
  });

  it('returns null for a non-github url', () => {
    expect(
      parseGitHubReferenceUrl('https://example.com/octo/repo/issues/1'),
    ).toBeNull();
  });

  it('returns null for a github user-attachments link', () => {
    expect(
      parseGitHubReferenceUrl('https://github.com/user-attachments/assets/abc'),
    ).toBeNull();
  });
});

describe('referenceStateToIconInput', () => {
  it('maps a merged pull request to the pull request icon input', () => {
    expect(
      referenceStateToIconInput({
        state: 'CLOSED',
        merged: true,
        isPullRequest: true,
        title: 'merged pr',
      }),
    ).toEqual({
      isPr: true,
      state: 'closed',
      merged: true,
      isDraft: false,
      stateReason: '',
    });
  });

  it('maps an open issue to the issue icon input', () => {
    expect(
      referenceStateToIconInput({
        state: 'OPEN',
        merged: false,
        isPullRequest: false,
        title: 'open issue',
      }),
    ).toEqual({
      isPr: false,
      state: 'open',
      merged: false,
      isDraft: false,
      stateReason: '',
    });
  });
});
