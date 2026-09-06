import { IssueCommentRepository } from '../../domain/usecases/adapter-interfaces/IssueCommentRepository';
import { Issue } from '../../domain/entities/Issue';
import { Comment } from '../../domain/entities/Comment';
import {
  isDuplicateWithinWindow,
  DUPLICATE_COMMENT_WINDOW_MS,
} from './commentDeduplication';

type RestCommentPayload = {
  user: { login: string } | null;
  body: string;
  created_at: string;
};

type SerializedComment = {
  author: string;
  content: string;
  createdAt: string;
};

type CommentCacheEntry = {
  etag: string;
  comments: SerializedComment[];
};

type CommentCacheRepository = {
  getSingle(key: string): Promise<unknown>;
  setSingle<T>(key: string, value: T): Promise<void>;
};

function isRestCommentPayloadArray(
  value: unknown,
): value is RestCommentPayload[] {
  if (!Array.isArray(value)) return false;
  return true;
}

function isCommentCacheEntry(value: unknown): value is CommentCacheEntry {
  if (typeof value !== 'object' || value === null) return false;
  if (!('etag' in value) || typeof value.etag !== 'string') return false;
  if (!('comments' in value) || !Array.isArray(value.comments)) return false;
  return value.comments.every(
    (c: unknown) =>
      typeof c === 'object' &&
      c !== null &&
      'author' in c &&
      typeof c.author === 'string' &&
      'content' in c &&
      typeof c.content === 'string' &&
      'createdAt' in c &&
      typeof c.createdAt === 'string',
  );
}

export class GitHubIssueCommentRepository implements IssueCommentRepository {
  constructor(
    private readonly token: string,
    private readonly commentCacheRepository: CommentCacheRepository | null = null,
  ) {}

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

  private commentCacheKey(
    owner: string,
    repo: string,
    issueNumber: number,
  ): string {
    return `comments/${owner}/${repo}/${issueNumber}`;
  }

  private async readCommentCache(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<CommentCacheEntry | null> {
    if (!this.commentCacheRepository) return null;
    const raw = await this.commentCacheRepository.getSingle(
      this.commentCacheKey(owner, repo, issueNumber),
    );
    return isCommentCacheEntry(raw) ? raw : null;
  }

  private async writeCommentCache(
    owner: string,
    repo: string,
    issueNumber: number,
    etag: string,
    comments: Comment[],
  ): Promise<void> {
    if (!this.commentCacheRepository) return;
    await this.commentCacheRepository.setSingle(
      this.commentCacheKey(owner, repo, issueNumber),
      {
        etag,
        comments: comments.map((c) => ({
          author: c.author,
          content: c.content,
          createdAt: c.createdAt.toISOString(),
        })),
      },
    );
  }

  async getCommentsFromIssue(issue: Issue): Promise<Comment[]> {
    const { owner, repo, issueNumber } = this.parseIssueUrl(issue);

    const cachedEntry = await this.readCommentCache(owner, repo, issueNumber);

    const comments: Comment[] = [];
    let page = 1;
    let hasNextPage = true;
    let newEtag: string | null = null;

    while (hasNextPage) {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
      };
      if (page === 1 && cachedEntry) {
        headers['If-None-Match'] = cachedEntry.etag;
      }

      const response = await fetch(url, { headers });

      if (response.status === 304 && cachedEntry) {
        return cachedEntry.comments.map((c) => ({
          author: c.author,
          content: c.content,
          createdAt: new Date(c.createdAt),
        }));
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch comments from GitHub REST API: ${response.status} ${response.statusText}`,
        );
      }

      if (page === 1) {
        newEtag = response.headers.get('ETag');
      }

      const responseData: unknown = await response.json();
      if (!isRestCommentPayloadArray(responseData)) {
        throw new Error(
          'Unexpected response shape when fetching comments from GitHub REST API',
        );
      }

      for (const payload of responseData) {
        comments.push({
          author: payload.user?.login ?? '',
          content: payload.body,
          createdAt: new Date(payload.created_at),
        });
      }

      const linkHeader = response.headers.get('Link') ?? '';
      hasNextPage = linkHeader.includes('rel="next"');

      page++;
    }

    if (newEtag) {
      await this.writeCommentCache(owner, repo, issueNumber, newEtag, comments);
    }

    return comments;
  }

  private async fetchCommentsForDedupCheck(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<ReadonlyArray<{ text: string; createdAt: Date }> | null> {
    const since = new Date(
      Date.now() - DUPLICATE_COMMENT_WINDOW_MS,
    ).toISOString();
    const comments: Array<{ text: string; createdAt: Date }> = [];
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
    };

    let url: string | null =
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&since=${encodeURIComponent(since)}`;

    try {
      while (url !== null) {
        const response: Response = await fetch(url, { headers });

        if (!response.ok) {
          return null;
        }

        const body: unknown = await response.json();
        if (!isRestCommentPayloadArray(body)) {
          return null;
        }

        for (const item of body) {
          comments.push({
            text: item.body,
            createdAt: new Date(item.created_at),
          });
        }

        const linkHeader: string = response.headers.get('Link') ?? '';
        const nextMatch: RegExpMatchArray | null = linkHeader.match(
          /<([^>]+)>;\s*rel="next"/,
        );
        url = nextMatch?.[1] ?? null;
      }
    } catch {
      return null;
    }

    return comments;
  }

  async createComment(issue: Issue, commentContent: string): Promise<void> {
    const { owner, repo, issueNumber } = this.parseIssueUrl(issue);

    const existingComments = await this.fetchCommentsForDedupCheck(
      owner,
      repo,
      issueNumber,
    );
    if (existingComments !== null) {
      const now = new Date();
      if (isDuplicateWithinWindow(commentContent, existingComments, now)) {
        console.warn(
          `GitHubIssueCommentRepository: skipping duplicate comment within ${DUPLICATE_COMMENT_WINDOW_MS / 60000} minutes on ${issue.url}`,
        );
        return;
      }
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: commentContent }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to create comment via GitHub REST API: ${response.status} ${response.statusText}`,
      );
    }
  }
}
