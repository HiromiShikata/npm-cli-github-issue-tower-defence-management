import { pullRequestReferencedIssueUrls } from './pullRequestReferencedIssueUrls';
const issue = (
  overrides: Partial<{
    closingIssueReferenceUrls: string[];
    plainCrossRepoIssueReferenceUrls: string[];
  }>,
) => ({
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  ...overrides,
});

describe('pullRequestReferencedIssueUrls', () => {
  test.each([
    {
      name: 'returns closing and non-closing references without duplicates',
      input: issue({
        closingIssueReferenceUrls: ['issue-1', 'issue-2'],
        plainCrossRepoIssueReferenceUrls: ['issue-2', 'issue-3'],
      }),
      expected: ['issue-1', 'issue-2', 'issue-3'],
    },
    {
      name: 'returns an empty list when a pull request has no references',
      input: issue({}),
      expected: [],
    },
  ])('$name', ({ input, expected }) => {
    expect(pullRequestReferencedIssueUrls(input)).toEqual(expected);
  });
});
