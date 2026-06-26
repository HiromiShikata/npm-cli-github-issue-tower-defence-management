import type { ReactNode } from 'react';
import type { ImageProxyUrlBuilder } from '../../lib/imageProxy';
import { colorFromEnum } from '../../logic/colors';
import {
  formatFullTimestamp,
  formatRelativeTime,
} from '../../logic/relativeTime';
import type {
  ConsoleChangedFile,
  ConsoleColor,
  ConsoleComment,
  ConsoleCommit,
  ConsoleIssueState,
  ConsoleListItem,
  ConsoleOverlayStatus,
  ConsoleRelatedPullRequest,
} from '../../logic/types';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';
import { ConsolePanel } from '../layout/ConsolePanel';
import { ConsoleChangedFileList } from './ConsoleChangedFileList';
import { ConsoleCommentList } from './ConsoleCommentList';
import { ConsoleCommitList } from './ConsoleCommitList';
import type { ConsoleAddInlineComment } from './ConsoleFileDiff';
import { ConsoleItemIcon } from './ConsoleItemIcon';
import { ConsolePullRequestDetail } from './ConsolePullRequestDetail';

export type ConsoleRelatedPullRequestView = {
  pullRequest: ConsoleRelatedPullRequest;
  files: ConsoleChangedFile[];
  filesAreLoading: boolean;
  filesError: string | null;
  commits: ConsoleCommit[];
  commitsAreLoading: boolean;
  commitsError: string | null;
};

export type ConsoleItemDetailProps = {
  item: ConsoleListItem;
  storyName: string | null;
  storyColorEnum: ConsoleColor | null;
  overlayStatus: ConsoleOverlayStatus | null;
  state: ConsoleIssueState | null;
  body: string;
  bodyIsLoading: boolean;
  bodyError: string | null;
  comments: ConsoleComment[];
  commentsAreLoading: boolean;
  commentsError: string | null;
  files: ConsoleChangedFile[];
  filesAreLoading: boolean;
  filesError: string | null;
  commits: ConsoleCommit[];
  commitsAreLoading: boolean;
  commitsError: string | null;
  relatedPullRequests: ConsoleRelatedPullRequestView[];
  now: number;
  commentComposer: ReactNode;
  operationBar: ReactNode;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  onAddInlineComment?: ConsoleAddInlineComment;
};

export const ConsoleItemDetail = ({
  item,
  storyName,
  storyColorEnum,
  overlayStatus,
  state,
  body,
  bodyIsLoading,
  bodyError,
  comments,
  commentsAreLoading,
  commentsError,
  files,
  filesAreLoading,
  filesError,
  commits,
  commitsAreLoading,
  commitsError,
  relatedPullRequests,
  now,
  commentComposer,
  operationBar,
  buildImageProxyUrl,
  onAddInlineComment,
}: ConsoleItemDetailProps) => {
  const resolvedState = state?.state ?? 'open';
  const merged = state?.merged ?? false;
  const closedStateLabel =
    !item.isPr && resolvedState === 'closed' ? 'Closed' : null;
  const storyPalette = colorFromEnum(storyColorEnum);
  const statusPalette = overlayStatus
    ? colorFromEnum(overlayStatus.color)
    : null;
  const filesCount =
    filesAreLoading || filesError !== null ? null : files.length;
  const commentsCount =
    commentsAreLoading || commentsError !== null ? null : comments.length;
  const commitsCount =
    commitsAreLoading || commitsError !== null ? null : commits.length;

  return (
    <article className="console-detail">
      {storyName !== null && (
        <div className="console-detail-story">
          <span className="console-storytag">
            <span
              className="console-story-dot"
              style={{ backgroundColor: storyPalette.dot }}
            />
            {storyName}
          </span>
        </div>
      )}

      {overlayStatus !== null && statusPalette !== null && (
        <span
          className="console-detail-status-chip"
          style={{
            color: statusPalette.fg,
            borderColor: statusPalette.border,
            backgroundColor: statusPalette.bg,
          }}
        >
          {overlayStatus.name}
        </span>
      )}

      <h2 className="console-detail-title">
        <ConsoleItemIcon
          isPr={item.isPr}
          state={resolvedState}
          merged={merged}
          isDraft={false}
          stateReason=""
        />
        <span className="console-detail-title-text">{item.title}</span>
        <span className="console-detail-number">
          {item.isPr ? `PR #${item.number}` : `#${item.number}`}
        </span>
        {closedStateLabel !== null && (
          <span className="console-detail-closed-label">
            {closedStateLabel}
          </span>
        )}
      </h2>

      <div className="console-detail-subbar">
        <a
          href={item.url}
          className="console-detail-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.isPr ? `PR #${item.number}` : `Issue #${item.number}`}
        </a>
        <span className="console-detail-repo">{item.repo}</span>
        <span className="console-detail-pill">
          {item.isPr ? 'PR' : 'Issue'}
        </span>
      </div>

      {item.labels.length > 0 && (
        <div className="console-detail-labels">
          {item.labels.map((label) => (
            <span key={label} className="console-label-chip">
              {label}
            </span>
          ))}
        </div>
      )}

      <div
        className="console-detail-createdat"
        title={formatFullTimestamp(item.createdAt)}
      >
        opened {formatRelativeTime(item.createdAt, now)}
      </div>

      <ConsolePanel
        title="Description"
        headerAction={
          <a
            href={item.url}
            className="console-panel-open-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            open
          </a>
        }
      >
        {bodyError !== null ? (
          <p role="alert" className="console-detail-body-error">
            Failed to load description: {bodyError}
          </p>
        ) : bodyIsLoading ? (
          <p className="console-detail-body-loading">Loading description...</p>
        ) : (
          <ConsoleMarkdownContent
            body={body}
            buildImageProxyUrl={buildImageProxyUrl}
          />
        )}
      </ConsolePanel>

      {item.isPr && (
        <ConsolePanel title="Changed files" count={filesCount}>
          <ConsoleChangedFileList
            files={files}
            isLoading={filesAreLoading}
            error={filesError}
            onAddInlineComment={onAddInlineComment}
          />
        </ConsolePanel>
      )}

      <ConsolePanel
        title="Comments"
        count={commentsCount}
        defaultCollapsed={item.isPr}
      >
        <ConsoleCommentList
          comments={comments}
          isLoading={commentsAreLoading}
          error={commentsError}
          now={now}
          buildImageProxyUrl={buildImageProxyUrl}
        />
      </ConsolePanel>

      {item.isPr && (
        <ConsolePanel title="Commits" count={commitsCount} defaultCollapsed>
          <ConsoleCommitList
            commits={commits}
            isLoading={commitsAreLoading}
            error={commitsError}
            now={now}
          />
        </ConsolePanel>
      )}

      {!item.isPr &&
        relatedPullRequests.map((related) => (
          <ConsolePullRequestDetail
            key={related.pullRequest.url}
            pullRequest={related.pullRequest}
            body={related.pullRequest.summary?.body ?? ''}
            bodyIsLoading={false}
            files={related.files}
            filesAreLoading={related.filesAreLoading}
            filesError={related.filesError}
            commits={related.commits}
            commitsAreLoading={related.commitsAreLoading}
            commitsError={related.commitsError}
            now={now}
            buildImageProxyUrl={buildImageProxyUrl}
          />
        ))}

      {commentComposer}

      <div className="console-actionbar">{operationBar}</div>
    </article>
  );
};
