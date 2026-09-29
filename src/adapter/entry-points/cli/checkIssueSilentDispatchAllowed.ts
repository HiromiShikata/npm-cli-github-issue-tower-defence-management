import { isSilentDispatchAllowedByIssueBody } from '../../../domain/usecases/isSilentDispatchAllowedByIssueBody';

export type CheckIssueSilentDispatchAllowedOutput = {
  stdout: string | null;
  stderr: string | null;
  exitCode: 0 | 1 | 2;
};

const parseIssueUrl = (
  issueUrl: string,
): { owner: string; repo: string; issueNumber: number } | null => {
  const match = issueUrl.match(
    /github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
  );
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2],
    issueNumber: parseInt(match[4], 10),
  };
};

export const checkIssueSilentDispatchAllowed = async (input: {
  issueUrl: string;
  ghToken: string;
}): Promise<CheckIssueSilentDispatchAllowedOutput> => {
  const parsed = parseIssueUrl(input.issueUrl);
  if (!parsed) {
    return {
      stdout: null,
      stderr: `Invalid GitHub issue URL: ${input.issueUrl}`,
      exitCode: 2,
    };
  }
  const { owner, repo, issueNumber } = parsed;

  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${input.ghToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
  } catch (error) {
    return {
      stdout: null,
      stderr: `Failed to fetch issue ${input.issueUrl}: ${error instanceof Error ? error.message : String(error)}`,
      exitCode: 2,
    };
  }

  if (!response.ok) {
    return {
      stdout: null,
      stderr: `Failed to fetch issue ${input.issueUrl}: ${response.status} ${response.statusText}`,
      exitCode: 2,
    };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    return {
      stdout: null,
      stderr: `Failed to parse issue ${input.issueUrl}: ${error instanceof Error ? error.message : String(error)}`,
      exitCode: 2,
    };
  }
  const rawBody =
    typeof data === 'object' && data !== null && 'body' in data
      ? data.body
      : undefined;
  const body = typeof rawBody === 'string' ? rawBody : null;
  const isAllowed = isSilentDispatchAllowedByIssueBody(body);
  return { stdout: null, stderr: null, exitCode: isAllowed ? 0 : 1 };
};
