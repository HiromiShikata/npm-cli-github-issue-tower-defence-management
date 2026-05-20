import { IssueCommentRepository } from '../../domain/usecases/adapter-interfaces/IssueCommentRepository';
import { Issue } from '../../domain/entities/Issue';
import { Comment } from '../../domain/entities/Comment';

type CreateCommentResponse = {
  data?: {
    addComment?: {
      commentEdge: {
        node: {
          id: string;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
};

type IssueIdResponse = {
  data?: {
    repository?: {
      issue?: {
        id: string;
      };
      pullRequest?: {
        id: string;
      };
    };
  };
};

function isCreateCommentResponse(
  value: unknown,
): value is CreateCommentResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

function isIssueIdResponse(value: unknown): value is IssueIdResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

export class GitHubIssueCommentRepository implements IssueCommentRepository {
  constructor(private readonly token: string) {}

  private parseIssueUrl(issue: Issue): {
    owner: string;
    repo: string;
    issueNumber: number;
    isPr: boolean;
  } {
    const urlMatch = issue.url.match(
      /github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
    );
    if (!urlMatch) {
      throw new Error(`Invalid GitHub issue URL: ${issue.url}`);
    }
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      issueNumber: parseInt(urlMatch[4], 10),
      isPr: urlMatch[3] === 'pull',
    };
  }

  async getCommentsFromIssue(issue: Issue): Promise<Comment[]> {
    const { owner, repo, issueNumber } = this.parseIssueUrl(issue);

    const comments: Comment[] = [];
    let page = 1;

    while (true) {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch comments from GitHub REST API: ${response.status} ${response.statusText}`,
        );
      }

      const payloads = (await response.json()) as Array<{
        user: { login: string } | null;
        body: string;
        created_at: string;
      }>;

      for (const payload of payloads) {
        comments.push({
          author: payload.user?.login ?? '',
          content: payload.body,
          createdAt: new Date(payload.created_at),
        });
      }

      const linkHeader = response.headers.get('Link') ?? '';
      if (!linkHeader.includes('rel="next"')) {
        break;
      }

      page++;
    }

    return comments;
  }

  private async getIssueNodeId(issue: Issue): Promise<string> {
    const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issue);

    const entityType = isPr ? 'pullRequest' : 'issue';
    const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          ${entityType}(number: $issueNumber) {
            id
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          owner,
          repo,
          issueNumber,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch issue ID from GitHub GraphQL API: ${response.status} ${response.statusText}`,
      );
    }

    const responseData: unknown = await response.json();
    if (!isIssueIdResponse(responseData)) {
      throw new Error(
        'Unexpected response shape when fetching issue ID from GitHub GraphQL API',
      );
    }

    const issueId = isPr
      ? responseData.data?.repository?.pullRequest?.id
      : responseData.data?.repository?.issue?.id;
    if (!issueId) {
      throw new Error(
        `${isPr ? 'Pull request' : 'Issue'} not found when fetching issue ID from GitHub GraphQL API`,
      );
    }

    return issueId;
  }

  async createComment(issue: Issue, commentContent: string): Promise<void> {
    const issueId = await this.getIssueNodeId(issue);

    const mutation = `
      mutation($issueId: ID!, $body: String!) {
        addComment(input: {
          subjectId: $issueId
          body: $body
        }) {
          commentEdge {
            node {
              id
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          issueId,
          body: commentContent,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create comment via GitHub GraphQL API: ${response.status} ${response.statusText}`,
      );
    }

    const responseData: unknown = await response.json();
    if (!isCreateCommentResponse(responseData)) {
      throw new Error('Invalid API response format when creating comment');
    }

    if (responseData.errors) {
      throw new Error(
        `GraphQL errors when creating comment: ${JSON.stringify(responseData.errors)}`,
      );
    }
  }
}
