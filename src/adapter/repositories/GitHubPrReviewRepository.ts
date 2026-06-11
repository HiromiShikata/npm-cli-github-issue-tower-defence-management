import { BaseGitHubRepository } from './BaseGitHubRepository';
import { PrReviewRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';
import { IssueTitleInfo } from '../../domain/entities/PrReviewViewerItem';
import { GitHubApiError } from '../../domain/entities/GitHubApiError';

type ReviewComment = {
  path: string;
  position: number;
  body: string;
};

const ALLOWED_IMAGE_PROXY_HOSTNAMES = [
  'private-user-images.githubusercontent.com',
  'user-images.githubusercontent.com',
  'github.com',
];

const buildRepoApiUrl = (
  owner: string,
  repo: string,
  ...segments: (string | number)[]
): string => {
  const encoded = [
    encodeURIComponent(owner),
    encodeURIComponent(repo),
    ...segments.map((s) => encodeURIComponent(String(s))),
  ];
  return `https://api.github.com/repos/${encoded[0]}/${encoded[1]}/${encoded.slice(2).join('/')}`;
};

export class GitHubPrReviewRepository
  extends BaseGitHubRepository
  implements PrReviewRepository
{
  private extractGitHubErrorMessage = async (
    response: Response,
  ): Promise<string> => {
    try {
      const body: unknown = await response.json();
      if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body['message'] === 'string'
      ) {
        return body['message'];
      }
    } catch (_error) {
      process.stderr.write(String(_error) + '\n');
    }
    return `HTTP ${response.status}`;
  };

  approve = async (
    owner: string,
    repo: string,
    prNumber: number,
    body: string | null,
    comments: ReviewComment[] | null,
  ): Promise<void> => {
    const url = buildRepoApiUrl(owner, repo, 'pulls', prNumber, 'reviews');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        event: 'APPROVE',
        body: body ?? '',
        comments: comments ?? [],
      }),
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new GitHubApiError(message);
    }
  };

  requestChanges = async (
    owner: string,
    repo: string,
    prNumber: number,
    body: string | null,
    comments: ReviewComment[] | null,
  ): Promise<void> => {
    const url = buildRepoApiUrl(owner, repo, 'pulls', prNumber, 'reviews');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        event: 'REQUEST_CHANGES',
        body: body ?? '',
        comments: comments ?? [],
      }),
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new GitHubApiError(message);
    }
  };

  comment = async (
    owner: string,
    repo: string,
    prNumber: number,
    body: string | null,
    comments: ReviewComment[] | null,
  ): Promise<void> => {
    const url = buildRepoApiUrl(owner, repo, 'pulls', prNumber, 'reviews');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        event: 'COMMENT',
        body: body ?? '',
        comments: comments ?? [],
      }),
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new GitHubApiError(message);
    }
  };

  createComment = async (
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<void> => {
    const url = buildRepoApiUrl(owner, repo, 'issues', issueNumber, 'comments');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new GitHubApiError(message);
    }
  };

  closePullRequest = async (
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<void> => {
    const url = buildRepoApiUrl(owner, repo, 'pulls', prNumber);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({ state: 'closed' }),
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new GitHubApiError(message);
    }
  };

  addLabel = async (
    owner: string,
    repo: string,
    issueNumber: number,
    label: string,
  ): Promise<void> => {
    const url = buildRepoApiUrl(owner, repo, 'issues', issueNumber, 'labels');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({ labels: [label] }),
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new GitHubApiError(message);
    }
  };

  updateProjectItemStatus = async (
    projectId: string,
    fieldId: string,
    itemId: string,
    statusOptionId: string,
  ): Promise<void> => {
    const graphqlQuery = {
      query: `mutation UpdateProjectItemFieldValue($projectId: ID!, $fieldId: ID!, $itemId: ID!, $statusOptionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          fieldId: $fieldId
          itemId: $itemId
          value: { singleSelectOptionId: $statusOptionId },
        }) {
          clientMutationId
        }
      }`,
      variables: { projectId, fieldId, itemId, statusOptionId },
    };
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify(graphqlQuery),
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new GitHubApiError(message);
    }
    const result: unknown = await response.json();
    if (
      typeof result === 'object' &&
      result !== null &&
      'errors' in result &&
      Array.isArray(result['errors']) &&
      result['errors'].length > 0
    ) {
      const messages = result['errors']
        .filter(
          (e): e is { message: string } =>
            typeof e === 'object' && e !== null && 'message' in e,
        )
        .map((e) => e.message);
      throw new GitHubApiError(messages.join('\n'));
    }
  };

  getFileContent = async (
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    prHeadSha: string,
  ): Promise<{ content: Buffer; contentType: string }> => {
    const tryFetch = async (resolvedRef: string): Promise<Response> => {
      const encodedOwner = encodeURIComponent(owner);
      const encodedRepo = encodeURIComponent(repo);
      const encodedPath = filePath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const url = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}?ref=${encodeURIComponent(resolvedRef)}`;
      return fetch(url, {
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          Accept: 'application/vnd.github.raw+json',
        },
      });
    };

    let response = await tryFetch(ref);
    if (!response.ok && ref !== prHeadSha) {
      response = await tryFetch(prHeadSha);
    }
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new Error(message);
    }
    const arrayBuffer = await response.arrayBuffer();
    const content = Buffer.from(arrayBuffer);
    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    return { content, contentType };
  };

  fetchImageProxy = async (
    targetUrl: string,
  ): Promise<{ content: Buffer; contentType: string }> => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      throw new Error('Invalid URL');
    }
    const allowedIndex = ALLOWED_IMAGE_PROXY_HOSTNAMES.indexOf(
      parsedUrl.hostname,
    );
    if (allowedIndex === -1) {
      throw new Error('Hostname not allowed');
    }
    const safeHostname = ALLOWED_IMAGE_PROXY_HOSTNAMES[allowedIndex];
    const encodedPathAndQuery =
      parsedUrl.pathname.split('/').map(encodeURIComponent).join('/') +
      (parsedUrl.search
        ? '?' +
          Array.from(parsedUrl.searchParams.entries())
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join('&')
        : '');
    const safeUrl = `https://${safeHostname}${encodedPathAndQuery}`;
    const response = await fetch(safeUrl, {
      headers: {
        Authorization: `token ${this.ghToken}`,
      },
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new Error(message);
    }
    const arrayBuffer = await response.arrayBuffer();
    const content = Buffer.from(arrayBuffer);
    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    return { content, contentType };
  };

  getIssueOrPrTitle = async (
    owner: string,
    repo: string,
    number: number,
  ): Promise<IssueTitleInfo> => {
    const url = buildRepoApiUrl(owner, repo, 'issues', number);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new Error(message);
    }
    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('title' in data) ||
      !('state' in data) ||
      !('html_url' in data)
    ) {
      throw new Error('Unexpected GitHub API response format');
    }
    return {
      title: String(data['title']),
      state: String(data['state']),
      isPR: 'pull_request' in data && data['pull_request'] !== null,
      url: String(data['html_url']),
    };
  };
}
