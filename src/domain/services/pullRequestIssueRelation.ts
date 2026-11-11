export type PullRequestIssueRelationInput = {
  willCloseTarget: boolean;
  prBody: string | null;
  prUrl: string;
  issueUrl: string;
};

type RepositoryReference = {
  owner: string;
  repo: string;
};

type IssueReference = RepositoryReference & {
  number: string;
};

const REPOSITORY_NAME_PATTERN = String.raw`[A-Za-z0-9_.-]+`;

const ISSUE_URL_PATTERN = String.raw`https:\/\/github\.com\/(${REPOSITORY_NAME_PATTERN})\/(${REPOSITORY_NAME_PATTERN})\/issues\/(\d+)`;

const ISSUE_URL_REGEX = new RegExp(`^${ISSUE_URL_PATTERN}$`, 'i');

const PULL_REQUEST_URL_REGEX = new RegExp(
  String.raw`^https:\/\/github\.com\/(${REPOSITORY_NAME_PATTERN})\/(${REPOSITORY_NAME_PATTERN})\/pull\/\d+$`,
  'i',
);

const REF_LINE_REGEX = new RegExp(
  String.raw`^ref\s+(${ISSUE_URL_PATTERN})$`,
  'i',
);

const CLOSING_REFERENCE_REGEX = new RegExp(
  String.raw`(?<![A-Za-z0-9_])(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+(?:${ISSUE_URL_PATTERN}\/?(?![\w#/-])|(${REPOSITORY_NAME_PATTERN})\/(${REPOSITORY_NAME_PATTERN})#(\d+)(?!\d)|#(\d+)(?!\d))`,
  'gi',
);

const sameRepository = (
  left: RepositoryReference,
  right: RepositoryReference,
): boolean =>
  left.owner.toLowerCase() === right.owner.toLowerCase() &&
  left.repo.toLowerCase() === right.repo.toLowerCase();

const isSameIssue = (
  reference: IssueReference,
  issue: IssueReference,
): boolean =>
  sameRepository(reference, issue) && reference.number === issue.number;

const issueReferenceOf = (issueUrl: string): IssueReference | null => {
  const match = ISSUE_URL_REGEX.exec(issueUrl);
  if (match === null) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
};

const pullRequestRepositoryOf = (prUrl: string): RepositoryReference | null => {
  const match = PULL_REQUEST_URL_REGEX.exec(prUrl);
  if (match === null) return null;
  return { owner: match[1], repo: match[2] };
};

const closingReferenceMatchesIssue = (
  match: RegExpMatchArray,
  issue: IssueReference,
  pullRequest: RepositoryReference | null,
): boolean => {
  const [
    ,
    urlOwner,
    urlRepo,
    urlNumber,
    qualifiedOwner,
    qualifiedRepo,
    qualifiedNumber,
    shorthandNumber,
  ] = match;
  if (urlNumber !== undefined) {
    return isSameIssue(
      { owner: urlOwner, repo: urlRepo, number: urlNumber },
      issue,
    );
  }
  if (qualifiedNumber !== undefined) {
    return isSameIssue(
      { owner: qualifiedOwner, repo: qualifiedRepo, number: qualifiedNumber },
      issue,
    );
  }
  return (
    pullRequest !== null &&
    sameRepository(pullRequest, issue) &&
    shorthandNumber === issue.number
  );
};

export const pullRequestRefLineIssueUrls = (
  prBody: string | null,
): string[] => {
  if (prBody === null) return [];
  const issueUrls = prBody
    .split(/\r?\n/)
    .map((line) => REF_LINE_REGEX.exec(line.trim()))
    .flatMap((match) => (match === null ? [] : [match[1]]));
  return Array.from(new Set(issueUrls));
};

export const isPullRequestRelatedToIssue = (
  input: PullRequestIssueRelationInput,
): boolean => {
  if (input.willCloseTarget) return true;
  if (input.prBody === null) return false;
  const issue = issueReferenceOf(input.issueUrl);
  if (issue === null) return false;
  const pullRequest = pullRequestRepositoryOf(input.prUrl);
  const hasClosingReference = Array.from(
    input.prBody.matchAll(CLOSING_REFERENCE_REGEX),
  ).some((match) => closingReferenceMatchesIssue(match, issue, pullRequest));
  if (hasClosingReference) return true;
  return pullRequestRefLineIssueUrls(input.prBody).some((url) => {
    const reference = issueReferenceOf(url);
    return reference !== null && isSameIssue(reference, issue);
  });
};
