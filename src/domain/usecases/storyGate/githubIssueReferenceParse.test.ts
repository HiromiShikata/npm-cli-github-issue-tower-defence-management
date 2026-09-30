import {
  githubIssueReferenceParse,
  githubIssueUrlsExtractInOrder,
} from './githubIssueReferenceParse';

describe('githubIssueReferenceParse', () => {
  it.each([
    {
      url: 'https://github.com/example-org/repo/issues/12',
      expected: {
        owner: 'example-org',
        repo: 'repo',
        number: 12,
        url: 'https://github.com/example-org/repo/issues/12',
      },
    },
    {
      url: 'https://github.com/owner/repo.name/issues/3',
      expected: {
        owner: 'owner',
        repo: 'repo.name',
        number: 3,
        url: 'https://github.com/owner/repo.name/issues/3',
      },
    },
    { url: 'https://example.com/not-an-issue', expected: null },
    { url: 'https://github.com/owner/repo/issues/abc', expected: null },
    { url: 'https://github.com/owner/repo', expected: null },
    { url: '', expected: null },
  ])('parses $url', ({ url, expected }) => {
    expect(githubIssueReferenceParse(url)).toEqual(expected);
  });

  it('extracts GitHub issue URLs in body order without duplicates', () => {
    const text = [
      'First https://github.com/owner/repo/issues/3',
      'Second https://github.com/owner/other/issues/1',
      'Again https://github.com/owner/repo/issues/3',
      'Not GitHub https://example.com/owner/repo/issues/9',
    ].join('\n');

    expect(githubIssueUrlsExtractInOrder(text)).toEqual([
      'https://github.com/owner/repo/issues/3',
      'https://github.com/owner/other/issues/1',
    ]);
  });
});
