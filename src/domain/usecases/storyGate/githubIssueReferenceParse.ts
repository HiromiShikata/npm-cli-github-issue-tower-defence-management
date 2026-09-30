import { GithubIssueReference } from '../adapter-interfaces/StoryGateIssueRepository';

const GITHUB_ISSUE_URL_PATTERN =
  /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)$/;

const GITHUB_ISSUE_URL_IN_TEXT_PATTERN =
  /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:issues|pull)\/\d+/g;

export const githubIssueReferenceParse = (
  issueUrl: string,
): GithubIssueReference | null => {
  const match = issueUrl.match(GITHUB_ISSUE_URL_PATTERN);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2],
    number: Number.parseInt(match[3], 10),
    url: issueUrl,
  };
};

export const githubIssueUrlsExtractInOrder = (text: string): string[] => [
  ...new Set(text.match(GITHUB_ISSUE_URL_IN_TEXT_PATTERN) ?? []),
];
