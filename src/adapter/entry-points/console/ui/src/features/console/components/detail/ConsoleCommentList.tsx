import { useState } from "react";
import type { ImageProxyUrlBuilder } from "../../lib/imageProxy";
import type { ConsoleRepoContext } from "../../logic/references";
import { formatRelativeTime } from "../../logic/relativeTime";
import type { ConsoleComment } from "../../logic/types";
import { buildWorkflowIncidentReportUrl } from "../../logic/workflowIncidentReport";
import type { ConsoleReferenceLinkRenderer } from "../content/ConsoleMarkdownContent";
import { ConsoleMarkdownContent } from "../content/ConsoleMarkdownContent";

export type ConsoleCommentListProps = {
	comments: ConsoleComment[];
	isLoading: boolean;
	error: string | null;
	now: number;
	buildImageProxyUrl?: ImageProxyUrlBuilder;
	renderReferenceLink?: ConsoleReferenceLinkRenderer;
	repoContext?: ConsoleRepoContext;
	workflowImprovementIssueUrl?: string | null;
};

export const ConsoleCommentList = ({
	comments,
	isLoading,
	error,
	now,
	buildImageProxyUrl,
	renderReferenceLink,
	repoContext,
	workflowImprovementIssueUrl = null,
}: ConsoleCommentListProps) => {
	const [showAll, setShowAll] = useState<boolean>(false);

	if (error !== null) {
		return <p className="console-comment-notloaded">Not loaded.</p>;
	}

	if (isLoading) {
		return <p className="console-comment-loading">Loading comments...</p>;
	}

	if (comments.length === 0) {
		return <p className="console-comment-empty">No comments.</p>;
	}

	const visible = showAll ? comments : comments.slice(-1);

	return (
		<div className="console-comment-list">
			{!showAll && comments.length > 1 && (
				<button
					type="button"
					className="console-comment-show-all"
					onClick={() => setShowAll(true)}
				>
					Show all {comments.length}
				</button>
			)}
			{visible.map((comment) => (
				<article
					key={`${comment.author}:${comment.createdAt}:${comment.body}`}
					className="console-comment"
				>
					<header className="console-comment-header">
						<span className="console-comment-author">{comment.author}</span>
						<span className="console-comment-time">
							{formatRelativeTime(comment.createdAt, now)}
						</span>
						{workflowImprovementIssueUrl !== null && comment.url !== null && (
							<a
								href={buildWorkflowIncidentReportUrl(
									workflowImprovementIssueUrl,
									comment.url,
								)}
								target="_blank"
								rel="noreferrer"
								className="console-comment-report-link"
								aria-label="Create workflow incident report for this comment"
							>
								⚡
							</a>
						)}
					</header>
					<ConsoleMarkdownContent
						body={comment.body}
						buildImageProxyUrl={buildImageProxyUrl}
						renderReferenceLink={renderReferenceLink}
						repoContext={repoContext}
					/>
				</article>
			))}
		</div>
	);
};
