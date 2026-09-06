import { useState } from "react";
import type { ImageProxyUrlBuilder } from "../../lib/imageProxy";
import type { ConsoleRepoContext } from "../../lib/markdown";
import { formatRelativeTime } from "../../logic/relativeTime";
import type { ConsoleComment } from "../../logic/types";
import { buildWorkflowIncidentReportUrl } from "../../logic/workflowIncidentReport";
import type { ConsoleReferenceLinkRenderer } from "../content/ConsoleMarkdownContent";
import { ConsoleMarkdownContent } from "../content/ConsoleMarkdownContent";

const extractFirstLine = (body: string): string =>
	body.split("\n").find((line) => line.trim() !== "") ?? "";

export type ConsoleCommentListProps = {
	comments: ConsoleComment[];
	isLoading: boolean;
	error: string | null;
	now: number;
	workflowImprovementIssueUrl?: string | null;
	buildImageProxyUrl?: ImageProxyUrlBuilder;
	renderReferenceLink?: ConsoleReferenceLinkRenderer;
	repoContext?: ConsoleRepoContext;
};

export const ConsoleCommentList = ({
	comments,
	isLoading,
	error,
	now,
	workflowImprovementIssueUrl = null,
	buildImageProxyUrl,
	renderReferenceLink,
	repoContext,
}: ConsoleCommentListProps) => {
	const [showAll, setShowAll] = useState<boolean>(false);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
	const [expandedCommentKeys, setExpandedCommentKeys] = useState<Set<string>>(
		new Set(),
	);

	const toggleExpanded = (key: string) => {
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	if (error !== null) {
		return <p className="console-comment-notloaded">Not loaded.</p>;
	}

	if (isLoading) {
		return <p className="console-comment-loading">Loading comments...</p>;
	}

	if (comments.length === 0) {
		return <p className="console-comment-empty">No comments.</p>;
	}

	const isSummaryMode = !showAll && comments.length > 1;

	return (
		<div className="console-comment-list">
			{isSummaryMode && (
				<button
					type="button"
					className="console-comment-show-all"
					onClick={() => setShowAll(true)}
				>
					Show all {comments.length}
				</button>
			)}
			{comments.map((comment) => {
				const commentKey = `${comment.author}:${comment.createdAt}`;
				const longKey = `${comment.author}:${comment.createdAt}:${comment.body}`;
				const showSummary =
					isSummaryMode && !expandedCommentKeys.has(commentKey);
				const isExpanded = expandedKeys.has(longKey);
				const showFullBody = isSummaryMode
					? expandedCommentKeys.has(commentKey)
					: isExpanded;
				return (
					<article
						key={commentKey}
						data-expanded={showFullBody}
						className={`console-comment${showSummary ? " console-comment--expandable" : ""}`}
						onClick={
							showSummary
								? () =>
										setExpandedCommentKeys(
											(prev) => new Set([...prev, commentKey]),
										)
								: () => toggleExpanded(longKey)
						}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								if (showSummary) {
									setExpandedCommentKeys(
										(prev) => new Set([...prev, commentKey]),
									);
								} else {
									toggleExpanded(longKey);
								}
							}
						}}
					>
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
						{!showFullBody && (
							<span className="console-comment-body-preview">
								{extractFirstLine(comment.body)}
							</span>
						)}
						{showFullBody && (
							<div className="console-comment-body-expanded">
								<ConsoleMarkdownContent
									body={comment.body}
									buildImageProxyUrl={buildImageProxyUrl}
									renderReferenceLink={renderReferenceLink}
									repoContext={repoContext}
								/>
							</div>
						)}
					</article>
				);
			})}
		</div>
	);
};
