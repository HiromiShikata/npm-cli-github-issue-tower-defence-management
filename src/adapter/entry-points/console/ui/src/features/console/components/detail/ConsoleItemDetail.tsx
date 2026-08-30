import type { ReactNode } from 'react';
import type { ImageProxyUrlBuilder } from '../../lib/imageProxy';
import { colorFromEnum } from '../../logic/colors';
import {
  parseGitHubReferenceUrl,
  parseNameWithOwner,
} from '../../logic/references';
import {
  formatFullTimestamp,
  formatRelativeTime,
} from '../../logic/relativeTime';
import type {
  ConsoleChangedFile,
  ConsoleColor,
  ConsoleComment,
  ConsoleCommit,
  ConsoleFieldOption,
  ConsoleIssueState,
  ConsoleListItem,
  ConsoleMergeableStatus,
  ConsoleOverlayStatus,
  ConsolePullRequestStatus,
  ConsoleRelatedPullRequest,
} from '../../logic/types';
import type { ConsoleReferenceLinkRenderer } from '../content/ConsoleMarkdownContent';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';
import { ConsolePanel } from '../layout/ConsolePanel';
import { ConsoleChangedFileList } from './ConsoleChangedFileList';
import { ConsoleCommentList } from './ConsoleCommentList';
import { ConsoleCommitList } from './ConsoleCommitList';
import { ConsoleCopyUrlButton } from './ConsoleCopyUrlButton';
import type { ConsoleFetchFailure } from './ConsoleFetchFailureAlert';
import { ConsoleFetchFailureAlert } from './ConsoleFetchFailureAlert';
import type { ConsoleAddInlineComment } from './ConsoleFileDiff';
import { ConsoleItemIcon } from './ConsoleItemIcon';
import { ConsolePullRequestDetail } from './ConsolePullRequestDetail';
import { ConsolePullRequestMergeableChip } from './ConsolePullRequestMergeableChip';
import { ConsolePullRequestStatusBadges } from './ConsolePullRequestStatusBadges';

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
  statusOptions: ConsoleFieldOption[];
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
  stateError: string | null;
  pullRequestStatus: ConsolePullRequestStatus | null;
  pullRequestStatusError: string | null;
  relatedPullRequests: ConsoleRelatedPullRequestView[];
  relatedPullRequestsError: string | null;
  now: number;
  commentComposer: ReactNode;
  operationBar: ReactNode;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  onAddInlineComment?: ConsoleAddInlineComment;
};

export const ConsoleItemDetail = ({
  item,
  storyName,
  storyColorEnum,
  overlayStatus,
  statusOptions,
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
  stateError,
  pullRequestStatus,
  pullRequestStatusError,
  relatedPullRequests,
  relatedPullRequestsError,
  now,
  commentComposer,
  operationBar,
  buildImageProxyUrl,
  renderReferenceLink,
  onAddInlineComment,
}: ConsoleItemDetailProps) => {
  const resolvedState = state?.state ?? 'open';
  const merged = state?.merged ?? false;
  const closedStateLabel =
    !item.isPr && resolvedState === 'closed' ? 'Closed' : null;
  const repoContext = parseNameWithOwner(item.nameWithOwner) ?? undefined;
  const storyPalette = colorFromEnum(storyColorEnum);
  const displayStatus: ConsoleOverlayStatus | null =
    overlayStatus !== null
      ? overlayStatus
      : item.status !== null
        ? {
            name: item.status,
            color:
              statusOptions.find((o) => o.name === item.status)?.color ??
              'GRAY',
          }
        : null;
  const statusPalette =
    displayStatus !== null ? colorFromEnum(displayStatus.color) : null;
  const filesCount =
    filesAreLoading || filesError !== null ? null : files.length;
  const commentsCount =
    commentsAreLoading || commentsError !== null ? null : comments.length;
  const commitsCount =
    commitsAreLoading || commitsError !== null ? null : commits.length;
  const relatedPullRequestLabel = (url: string): string => {
    const reference = parseGitHubReferenceUrl(url);
    return reference === null ? url : `PR #${reference.number}`;
  };
  const fetchFailures: ConsoleFetchFailure[] = [
    { section: 'item state', message: stateError },
    {
      section: 'pull request status',
      message: item.isPr ? pullRequestStatusError : null,
    },
    { section: 'description', message: bodyError },
    { section: 'comments', message: commentsError },
    { section: 'changed files', message: item.isPr ? filesError : null },
    { section: 'commits', message: item.isPr ? commitsError : null },
    {
      section: 'related pull requests',
      message: item.isPr ? null : relatedPullRequestsError,
    },
    ...relatedPullRequests.flatMap((related) => [
      {
        section: `changed files of ${relatedPullRequestLabel(related.pullRequest.url)}`,
        message: related.filesError,
      },
      {
        section: `commits of ${relatedPullRequestLabel(related.pullRequest.url)}`,
        message: related.commitsError,
      },
    ]),
  ].flatMap((candidate) =>
    candidate.message === null
      ? []
      : [{ section: candidate.section, message: candidate.message }],
  );
  const mergeableChips: {
    url: string;
    mergeableStatus: ConsoleMergeableStatus;
  }[] =
    item.isPr && pullRequestStatus?.found
      ? [{ url: item.url, mergeableStatus: pullRequestStatus.mergeableStatus }]
      : [];

  return (
    <article className="console-detail">
      <div className="console-detail-header">
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
        </h2>

        <div className="console-detail-topline">
          {displayStatus !== null && statusPalette !== null && (
            <span
              className="console-detail-status-chip"
              style={{
                color: statusPalette.fg,
                borderColor: statusPalette.border,
                backgroundColor: statusPalette.bg,
              }}
            >
              {displayStatus.name}
            </span>
          )}
          {item.agent !== null && item.agent !== '' && (
            <span className="console-detail-agent-chip">{item.agent}</span>
          )}
          {storyName !== null && (
            <span className="console-storytag">
              <span
                className="console-story-dot"
                style={{ backgroundColor: storyPalette.dot }}
              />
              {storyName}
            </span>
          )}
          {item.isPr && pullRequestStatus?.found && (
            <ConsolePullRequestStatusBadges
              isPassedAllCiJob={pullRequestStatus.isPassedAllCiJob}
              isCiStateSuccess={pullRequestStatus.isCiStateSuccess}
              isBranchOutOfDate={pullRequestStatus.isBranchOutOfDate}
              missingRequiredCheckNames={
                pullRequestStatus.missingRequiredCheckNames
              }
            />
          )}
          {!item.isPr &&
            relatedPullRequests.map((related) => (
              <span
                key={related.pullRequest.url}
                className="console-related-pr-group"
              >
                {relatedPullRequests.length > 1 && (
                  <span className="console-related-pr-label">
                    {relatedPullRequestLabel(related.pullRequest.url)}
                  </span>
                )}
                <ConsolePullRequestStatusBadges
                  isPassedAllCiJob={related.pullRequest.isPassedAllCiJob}
                  isCiStateSuccess={related.pullRequest.isCiStateSuccess}
                  isBranchOutOfDate={related.pullRequest.isBranchOutOfDate}
                  missingRequiredCheckNames={
                    related.pullRequest.missingRequiredCheckNames
                  }
                />
                <ConsolePullRequestMergeableChip
                  mergeableStatus={related.pullRequest.mergeableStatus}
                />
              </span>
            ))}
          {mergeableChips.map((chip) => (
            <ConsolePullRequestMergeableChip
              key={chip.url}
              mergeableStatus={chip.mergeableStatus}
            />
          ))}
          {closedStateLabel !== null && (
            <span className="console-detail-closed-label">
              {closedStateLabel}
            </span>
          )}
        </div>

        <ConsoleFetchFailureAlert failures={fetchFailures} />

        <div className="console-detail-subbar">
          <a
            href={item.url}
            className="console-detail-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            #{item.number}
          </a>
          <span className="console-detail-repo">{item.repo}</span>
          <span
            className="console-detail-createdat"
            title={formatFullTimestamp(item.createdAt)}
          >
            opened {formatRelativeTime(item.createdAt, now)}
          </span>
          <ConsoleCopyUrlButton url={item.url} />
          {item.labels.map((label) => (
            <span key={label} className="console-label-chip">
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="console-detail-body">
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
            <p className="console-detail-body-notloaded">Not loaded.</p>
          ) : bodyIsLoading ? (
            <p className="console-detail-body-loading">
              Loading description...
            </p>
          ) : (
            <ConsoleMarkdownContent
              body={body}
              buildImageProxyUrl={buildImageProxyUrl}
              renderReferenceLink={renderReferenceLink}
              repoContext={repoContext}
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
            renderReferenceLink={renderReferenceLink}
            repoContext={repoContext}
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
              renderReferenceLink={renderReferenceLink}
              onAddInlineComment={onAddInlineComment}
            />
          ))}
      </div>

      <div className="console-detail-dock">
        <div className="console-detail-dock-composer">{commentComposer}</div>
        <div className="console-actionbar">{operationBar}</div>
      </div>
    </article>
  );
};
