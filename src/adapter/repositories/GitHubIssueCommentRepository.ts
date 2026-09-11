import {
	captureRestCallSite,
	logGithubRestRateLimit,
	sanitizeRestPath,
} from "./githubRestClient";
import { IssueCommentRepository } from "../../domain/usecases/adapter-interfaces/IssueCommentRepository";
import { Issue } from "../../domain/entities/Issue";
import { Comment } from "../../domain/entities/Comment";
import {
	checkSecondaryRateLimitBreaker,
	secondaryRateLimitStateFilePath,
	writeSecondaryRateLimitState,
} from "./issue/githubSecondaryRateLimitBreaker";
import {
	computeSecondaryRateLimitBackoffMs,
	GitHubRateLimitError,
	isSecondaryRateLimit,
	realSleep,
	Sleep,
} from "./issue/githubRateLimitRetry";

export const FETCH_COMMENTS_TRANSIENT_ERROR_MAX_RETRIES = 3;
export const FETCH_COMMENTS_TRANSIENT_ERROR_BASE_BACKOFF_MS = 1000;

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

type PageCacheEntry = {
	etag: string;
	comments: SerializedComment[];
	hasNextPage: boolean;
};

type CommentPageCache = {
	pages: Record<string, PageCacheEntry>;
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

function isPageCacheEntry(value: unknown): value is PageCacheEntry {
	if (typeof value !== "object" || value === null) return false;
	if (!("etag" in value) || typeof value.etag !== "string") return false;
	if (!("comments" in value) || !Array.isArray(value.comments)) return false;
	if (!("hasNextPage" in value) || typeof value.hasNextPage !== "boolean")
		return false;
	return value.comments.every(
		(c: unknown) =>
			typeof c === "object" &&
			c !== null &&
			"author" in c &&
			typeof c.author === "string" &&
			"content" in c &&
			typeof c.content === "string" &&
			"createdAt" in c &&
			typeof c.createdAt === "string",
	);
}

function isCommentPageCache(value: unknown): value is CommentPageCache {
	if (typeof value !== "object" || value === null) return false;
	if (
		!("pages" in value) ||
		typeof value.pages !== "object" ||
		value.pages === null
	)
		return false;
	return Object.values(value.pages).every(isPageCacheEntry);
}

export class GitHubIssueCommentRepository implements IssueCommentRepository {
	constructor(
		private readonly token: string,
		private readonly commentCacheRepository: CommentCacheRepository | null = null,
		private readonly sleep: Sleep = realSleep,
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
			isPr: urlMatch[3] === "pull",
		};
	}

	private commentCacheKey(
		owner: string,
		repo: string,
		issueNumber: number,
	): string {
		return `comments/${owner}/${repo}/${issueNumber}`;
	}

	private async readCommentPageCache(
		owner: string,
		repo: string,
		issueNumber: number,
	): Promise<CommentPageCache | null> {
		if (!this.commentCacheRepository) return null;
		const raw = await this.commentCacheRepository.getSingle(
			this.commentCacheKey(owner, repo, issueNumber),
		);
		return isCommentPageCache(raw) ? raw : null;
	}

	private async writeCommentPageCache(
		owner: string,
		repo: string,
		issueNumber: number,
		pages: Record<string, PageCacheEntry>,
	): Promise<void> {
		if (!this.commentCacheRepository) return;
		await this.commentCacheRepository.setSingle(
			this.commentCacheKey(owner, repo, issueNumber),
			{ pages },
		);
	}

	private async fetchCommentsPage(
		url: string,
		headers: Record<string, string>,
	): Promise<Response> {
		let attempt = 0;
		for (;;) {
			const response = await fetch(url, { headers });
			if (response.ok || response.status === 304) return response;
			const isTransient = response.status === 404 || response.status >= 500;
			if (
				!isTransient ||
				attempt >= FETCH_COMMENTS_TRANSIENT_ERROR_MAX_RETRIES
			) {
				return response;
			}
			await this.sleep(
				FETCH_COMMENTS_TRANSIENT_ERROR_BASE_BACKOFF_MS * Math.pow(2, attempt),
			);
			attempt++;
		}
	}

	async getCommentsFromIssue(issue: Issue): Promise<Comment[]> {
		const { owner, repo, issueNumber } = this.parseIssueUrl(issue);

		const existingCache = await this.readCommentPageCache(
			owner,
			repo,
			issueNumber,
		);
		const cachedPages: Record<string, PageCacheEntry> = existingCache
			? { ...existingCache.pages }
			: {};

		const PER_PAGE = 100;
		const comments: Comment[] = [];
		const updatedPages: Record<string, PageCacheEntry> = { ...cachedPages };
		let cacheWasUpdated = false;
		let page = 1;
		let hasNextPage = true;

		while (hasNextPage) {
			const pageKey = String(page);
			const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=${PER_PAGE}&page=${page}`;
			const headers: Record<string, string> = {
				Authorization: `Bearer ${this.token}`,
				Accept: "application/vnd.github+json",
			};

			const cachedPage = cachedPages[pageKey];
			if (cachedPage) {
				headers["If-None-Match"] = cachedPage.etag;
			}

			const response = await this.fetchCommentsPage(url, headers);

			if (response.status === 304 && cachedPage) {
				for (const c of cachedPage.comments) {
					comments.push({
						author: c.author,
						content: c.content,
						createdAt: new Date(c.createdAt),
					});
				}
				hasNextPage =
					cachedPage.hasNextPage || cachedPage.comments.length >= PER_PAGE;
				page++;
				continue;
			}

			if (!response.ok) {
				throw new Error(
					`Failed to fetch comments from GitHub REST API: ${response.status} ${response.statusText}`,
				);
			}

			const responseData: unknown = await response.json();
			if (!isRestCommentPayloadArray(responseData)) {
				throw new Error(
					"Unexpected response shape when fetching comments from GitHub REST API",
				);
			}

			const pageComments: Comment[] = responseData.map((payload) => ({
				author: payload.user?.login ?? "",
				content: payload.body,
				createdAt: new Date(payload.created_at),
			}));

			for (const c of pageComments) {
				comments.push(c);
			}

			const linkHeader = response.headers.get("Link") ?? "";
			hasNextPage = linkHeader.includes('rel="next"');

			const etag = response.headers.get("ETag");
			if (etag) {
				updatedPages[pageKey] = {
					etag,
					comments: pageComments.map((c) => ({
						author: c.author,
						content: c.content,
						createdAt: c.createdAt.toISOString(),
					})),
					hasNextPage,
				};
				cacheWasUpdated = true;
			}

			page++;
		}

		if (cacheWasUpdated) {
			await this.writeCommentPageCache(owner, repo, issueNumber, updatedPages);
		}

		return comments;
	}

	async createComment(issue: Issue, commentContent: string): Promise<void> {
		const { owner, repo, issueNumber } = this.parseIssueUrl(issue);

		const caller = captureRestCallSite();
		const stateFilePath = secondaryRateLimitStateFilePath();
		const nowMsBeforePost = Date.now();
		const breaker = checkSecondaryRateLimitBreaker(
			nowMsBeforePost,
			stateFilePath,
		);
		if (breaker.isBlocked && breaker.resetTimeMs !== null) {
			throw new GitHubRateLimitError(
				`GitHub secondary rate limit is active until ${new Date(breaker.resetTimeMs).toISOString()}`,
				new Date(breaker.resetTimeMs).toISOString(),
			);
		}

		const commentUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
		const response = await fetch(commentUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.token}`,
				Accept: "application/vnd.github+json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ body: commentContent }),
		});

		if (!response.ok) {
			const bodyText = await response.text().catch(() => "");
			const nowMs = Date.now();
			if (isSecondaryRateLimit(response.headers, bodyText)) {
				const backoffMs = computeSecondaryRateLimitBackoffMs(
					response.headers,
					nowMs,
				);
				writeSecondaryRateLimitState(nowMs + backoffMs, nowMs, stateFilePath);
				throw new GitHubRateLimitError(
					`HTTP ${response.status} GitHub API secondary rate limit exceeded`,
					new Date(nowMs + backoffMs).toISOString(),
				);
			}
			throw new Error(
				`Failed to create comment via GitHub REST API: ${response.status} ${response.statusText}`,
			);
		}
		logGithubRestRateLimit({
			headers: response.headers,
			method: "POST",
			path: sanitizeRestPath(commentUrl),
			caller,
		});
	}
}
