import type { ConsoleItemIconInput } from './itemIcons';
import type { ConsoleIssueState } from './types';

export type ConsoleReferenceKind = 'issue' | 'pull';

export type ConsoleGitHubReference = {
  owner: string;
  repo: string;
  number: number;
  kind: ConsoleReferenceKind;
};

const GITHUB_REFERENCE_URL =
  /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/(issues|pull)\/(\d+)(?:[#?].*)?$/;

export const parseGitHubReferenceUrl = (
  href: string,
): ConsoleGitHubReference | null => {
  const match = GITHUB_REFERENCE_URL.exec(href.trim());
  if (match === null) {
    return null;
  }
  const [, owner, repo, segment, numberText] = match;
  const number = Number.parseInt(numberText, 10);
  if (!Number.isFinite(number)) {
    return null;
  }
  return {
    owner,
    repo,
    number,
    kind: segment === 'pull' ? 'pull' : 'issue',
  };
};

export const referenceStateToIconInput = (
  state: ConsoleIssueState,
): ConsoleItemIconInput => ({
  isPr: state.isPullRequest,
  state: state.state.toLowerCase(),
  merged: state.merged,
  isDraft: false,
  stateReason: '',
});
