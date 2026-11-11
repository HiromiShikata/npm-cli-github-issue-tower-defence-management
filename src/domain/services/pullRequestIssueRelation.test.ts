import {
  isPullRequestRelatedToIssue,
  pullRequestRefLineIssueUrls,
} from './pullRequestIssueRelation';

const ISSUE_URL = 'https://github.com/owner/repo/issues/5';
const OTHER_ISSUE_URL = 'https://github.com/owner/repo/issues/6';
const OTHER_REPO_ISSUE_URL =
  'https://github.com/other-owner/other-repo/issues/7';
const SAME_REPO_PR_URL = 'https://github.com/owner/repo/pull/9';
const OTHER_REPO_PR_URL = 'https://github.com/other-owner/other-repo/pull/9';

const closingKeywords = [
  'close',
  'closes',
  'closed',
  'fix',
  'fixes',
  'fixed',
  'resolve',
  'resolves',
  'resolved',
];

type RelationCase = {
  name: string;
  input: {
    willCloseTarget: boolean;
    prBody: string | null;
    prUrl: string;
    issueUrl: string;
  };
  expected: boolean;
};

const relationCase = (
  name: string,
  expected: boolean,
  overrides: Partial<RelationCase['input']> = {},
): RelationCase => ({
  name,
  expected,
  input: {
    willCloseTarget: false,
    prBody: null,
    prUrl: SAME_REPO_PR_URL,
    issueUrl: ISSUE_URL,
    ...overrides,
  },
});

const relationCases: RelationCase[] = [
  relationCase('willCloseTarget true without a body is related', true, {
    willCloseTarget: true,
  }),
  relationCase(
    'willCloseTarget true with a body that names no issue is related',
    true,
    { willCloseTarget: true, prBody: 'Unrelated text' },
  ),
  relationCase(
    'willCloseTarget true on a cross-repository pull request is related',
    true,
    { willCloseTarget: true, prUrl: OTHER_REPO_PR_URL },
  ),
  relationCase('willCloseTarget false without a body is not related', false),
  relationCase('empty body is not related', false, { prBody: '' }),
  ...closingKeywords.map((keyword) =>
    relationCase(`${keyword} followed by the full issue URL is related`, true, {
      prBody: `${keyword} ${ISSUE_URL}`,
    }),
  ),
  relationCase('closing keyword in upper case is related', true, {
    prBody: `FIXES ${ISSUE_URL}`,
  }),
  relationCase(
    'closing keyword and full issue URL on separate lines are related',
    true,
    { prBody: `Closes\n${ISSUE_URL}` },
  ),
  relationCase('closing keyword followed by a tab is related', true, {
    prBody: 'fixed\t#5',
  }),
  relationCase(
    'closing keyword with the full issue URL from another repository is related',
    true,
    { prBody: `Resolves ${ISSUE_URL}`, prUrl: OTHER_REPO_PR_URL },
  ),
  relationCase(
    'closing keyword with owner/repo#n from another repository is related',
    true,
    { prBody: 'Closes owner/repo#5', prUrl: OTHER_REPO_PR_URL },
  ),
  relationCase(
    'closing keyword with owner/repo#n in upper case is related',
    true,
    { prBody: 'Closes OWNER/REPO#5', prUrl: OTHER_REPO_PR_URL },
  ),
  relationCase(
    'closing keyword with shorthand #n in the same repository is related',
    true,
    { prBody: 'Closes #5' },
  ),
  relationCase(
    'closing keyword with the full issue URL in other letter case is related',
    true,
    { prBody: 'Closes https://github.com/Owner/REPO/issues/5' },
  ),
  relationCase(
    'closing keyword with shorthand #n from another repository is not related',
    false,
    { prBody: 'Closes #5', prUrl: OTHER_REPO_PR_URL },
  ),
  relationCase(
    'closing keyword with a full issue URL whose number is followed by a digit is not related',
    false,
    { prBody: 'Closes https://github.com/owner/repo/issues/50' },
  ),
  relationCase(
    'closing keyword with shorthand #n followed by a digit is not related',
    false,
    { prBody: 'Closes #50' },
  ),
  relationCase(
    'closing keyword with owner/repo#n followed by a digit is not related',
    false,
    { prBody: 'Closes owner/repo#50', prUrl: OTHER_REPO_PR_URL },
  ),
  relationCase(
    'closing keyword with a different issue number is not related',
    false,
    { prBody: 'Closes https://github.com/owner/repo/issues/6' },
  ),
  relationCase(
    'closing keyword with the issue URL of another repository is not related',
    false,
    { prBody: 'Closes https://github.com/other-owner/repo/issues/5' },
  ),
  relationCase(
    'closing keyword followed by other words before the reference is not related',
    false,
    { prBody: `Closes the issue ${ISSUE_URL}` },
  ),
  relationCase('Refs is not a closing keyword', false, {
    prBody: `Refs ${ISSUE_URL}`,
  }),
  relationCase('Relates to line is not related', false, {
    prBody: `Relates to ${ISSUE_URL}`,
  }),
  relationCase('Ref line with the full issue URL is related', true, {
    prBody: `Ref ${ISSUE_URL}`,
  }),
  relationCase(
    'Ref line in upper case with surrounding whitespace is related',
    true,
    { prBody: `   REF ${ISSUE_URL}   ` },
  ),
  relationCase(
    'Ref line with owner and repo in other letter case is related',
    true,
    { prBody: 'Ref https://github.com/OWNER/Repo/issues/5' },
  ),
  relationCase('Ref line on a cross-repository pull request is related', true, {
    prBody: `Ref ${ISSUE_URL}`,
    prUrl: OTHER_REPO_PR_URL,
  }),
  relationCase('Ref line among other lines is related', true, {
    prBody: `Summary text\nRef ${ISSUE_URL}\nMore text`,
  }),
  relationCase('Ref line with shorthand #n is not related', false, {
    prBody: 'Ref #5',
  }),
  relationCase('Ref line with owner/repo#n is not related', false, {
    prBody: 'Ref owner/repo#5',
  }),
  relationCase('Ref line with trailing text is not related', false, {
    prBody: `Ref ${ISSUE_URL} and more`,
  }),
  relationCase('Ref line inside a bullet item is not related', false, {
    prBody: `- Ref ${ISSUE_URL}`,
  }),
  relationCase('Ref line naming a pull request URL is not related', false, {
    prBody: 'Ref https://github.com/owner/repo/pull/5',
  }),
  relationCase(
    'Ref line whose number is followed by a digit is not related to issue 5',
    false,
    { prBody: 'Ref https://github.com/owner/repo/issues/50' },
  ),
  relationCase(
    'Ref line whose number is followed by a digit is related to issue 50',
    true,
    {
      prBody: 'Ref https://github.com/owner/repo/issues/50',
      issueUrl: 'https://github.com/owner/repo/issues/50',
    },
  ),
  relationCase('Ref line on another repository is not related', false, {
    prBody: 'Ref https://github.com/other-owner/repo/issues/5',
  }),
  relationCase('bullet-list URL is not related', false, {
    prBody: `- ${ISSUE_URL}`,
  }),
  relationCase('URL in prose is not related', false, {
    prBody: `Work on ${ISSUE_URL} next.`,
  }),
  relationCase(
    'quoted citation URL with an issuecomment fragment is not related',
    false,
    { prBody: `> ${ISSUE_URL}#issuecomment-123` },
  ),
  relationCase(
    'citation URL with an issuecomment fragment and no keyword is not related',
    false,
    { prBody: `Discussed in ${ISSUE_URL}#issuecomment-123` },
  ),
  relationCase(
    'Ref line for this issue with a bullet URL for another issue is related',
    true,
    { prBody: `Ref ${ISSUE_URL}\n- ${OTHER_ISSUE_URL}` },
  ),
  relationCase(
    'bullet URL for this issue with a Ref line for another issue is not related',
    false,
    { prBody: `Ref ${OTHER_ISSUE_URL}\n- ${ISSUE_URL}` },
  ),
  relationCase(
    'pull request whose Ref line names issue A is related to issue A',
    true,
    {
      prBody: `Ref ${ISSUE_URL}\n- ${OTHER_ISSUE_URL}`,
      issueUrl: ISSUE_URL,
    },
  ),
  relationCase(
    'pull request whose Ref line names issue A is not related to issue B named only in a bullet list',
    false,
    {
      prBody: `Ref ${ISSUE_URL}\n- ${OTHER_ISSUE_URL}`,
      issueUrl: OTHER_ISSUE_URL,
    },
  ),
  relationCase(
    'Ref line for an issue of another repository is related only to that issue',
    true,
    {
      prBody: `Ref ${OTHER_REPO_ISSUE_URL}`,
      issueUrl: OTHER_REPO_ISSUE_URL,
    },
  ),
  relationCase(
    'Ref line for an issue of another repository is not related to this issue',
    false,
    {
      prBody: `Ref ${OTHER_REPO_ISSUE_URL}`,
    },
  ),
];

type RefLineCase = {
  name: string;
  prBody: string | null;
  expected: string[];
};

const refLineCases: RefLineCase[] = [
  { name: 'null body yields no issue URLs', prBody: null, expected: [] },
  { name: 'empty body yields no issue URLs', prBody: '', expected: [] },
  {
    name: 'a Ref line yields its issue URL',
    prBody: `Ref ${ISSUE_URL}`,
    expected: [ISSUE_URL],
  },
  {
    name: 'a Ref line in lower case with surrounding whitespace yields its issue URL',
    prBody: `  ref ${ISSUE_URL}  `,
    expected: [ISSUE_URL],
  },
  {
    name: 'two Ref lines yield both issue URLs in order',
    prBody: `Ref ${ISSUE_URL}\nRef ${OTHER_REPO_ISSUE_URL}`,
    expected: [ISSUE_URL, OTHER_REPO_ISSUE_URL],
  },
  {
    name: 'duplicate Ref lines yield the issue URL once',
    prBody: `Ref ${ISSUE_URL}\nRef ${ISSUE_URL}`,
    expected: [ISSUE_URL],
  },
  {
    name: 'Ref lines separated by CRLF yield both issue URLs',
    prBody: `Ref ${ISSUE_URL}\r\nRef ${OTHER_REPO_ISSUE_URL}\r\n`,
    expected: [ISSUE_URL, OTHER_REPO_ISSUE_URL],
  },
  {
    name: 'the issue URL is returned as written in the Ref line',
    prBody: 'Ref https://github.com/Owner/Repo/issues/5',
    expected: ['https://github.com/Owner/Repo/issues/5'],
  },
  {
    name: 'a bullet-list URL yields no issue URL',
    prBody: `- ${ISSUE_URL}`,
    expected: [],
  },
  {
    name: 'a closing keyword line yields no issue URL',
    prBody: `Closes ${ISSUE_URL}`,
    expected: [],
  },
  {
    name: 'a Ref line naming a pull request yields no issue URL',
    prBody: 'Ref https://github.com/owner/repo/pull/5',
    expected: [],
  },
  {
    name: 'a Ref line with trailing text yields no issue URL',
    prBody: `Ref ${ISSUE_URL} and more`,
    expected: [],
  },
  {
    name: 'a Ref line with shorthand yields no issue URL',
    prBody: 'Ref #5',
    expected: [],
  },
  {
    name: 'only the Ref line is yielded when a bullet names another issue',
    prBody: `Ref ${ISSUE_URL}\n- ${OTHER_REPO_ISSUE_URL}\nCloses ${OTHER_ISSUE_URL}`,
    expected: [ISSUE_URL],
  },
];

describe('pullRequestIssueRelation', () => {
  it('decides whether a pull request is related to an issue by the approved rule for every case', () => {
    const actual = relationCases.map(({ name, input }) => ({
      name,
      related: isPullRequestRelatedToIssue(input),
    }));

    expect(actual).toEqual(
      relationCases.map(({ name, expected }) => ({
        name,
        related: expected,
      })),
    );
  });

  it('returns only the issue URLs named by Ref lines for every case', () => {
    const actual = refLineCases.map(({ name, prBody }) => ({
      name,
      issueUrls: pullRequestRefLineIssueUrls(prBody),
    }));

    expect(actual).toEqual(
      refLineCases.map(({ name, expected }) => ({
        name,
        issueUrls: expected,
      })),
    );
  });
});
