import type { ImageProxyUrlBuilder } from '../../lib/imageProxy';
import type {
  ConsoleChangedFile,
  ConsoleCommit,
  ConsoleRelatedPullRequest,
} from '../../logic/types';
import type { ConsoleReferenceLinkRenderer } from '../content/ConsoleMarkdownContent';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';
import { ConsolePanel } from '../layout/ConsolePanel';
import { ConsoleChangedFileList } from './ConsoleChangedFileList';
import { ConsoleCommitList } from './ConsoleCommitList';
import { ConsoleCopyUrlButton } from './ConsoleCopyUrlButton';
import type { ConsoleAddInlineComment } from './ConsoleFileDiff';
import { ConsolePullRequestStatusBadges } from './ConsolePullRequestStatusBadges';

export type ConsolePullRequestSectionProps = {
  pullRequest: ConsoleRelatedPullRequest;
  body: string;
  bodyIsLoading: boolean;
  files: ConsoleChangedFile[];
  filesAreLoading: boolean;
  filesError: string | null;
  commits: ConsoleCommit[];
  commitsAreLoading: boolean;
  commitsError: string | null;
  now: number;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  onAddInlineComment?: ConsoleAddInlineComment;
};

export const ConsolePullRequestDetail = ({
  pullRequest,
  body,
  bodyIsLoading,
  files,
  filesAreLoading,
  filesError,
  commits,
  commitsAreLoading,
  commitsError,
  now,
  buildImageProxyUrl,
  renderReferenceLink,
  onAddInlineComment,
}: ConsolePullRequestSectionProps) => {
  const summary = pullRequest.summary;
  const filesCount =
    filesAreLoading || filesError !== null ? null : files.length;
  const commitsCount =
    commitsAreLoading || commitsError !== null ? null : commits.length;
  return (
    <>
      <div className="console-pr-header">
        <a
          href={pullRequest.url}
          className="console-pr-section-title"
          target="_blank"
          rel="noopener noreferrer"
        >
          {summary?.title ?? pullRequest.url}
        </a>
        {pullRequest.isDraft && (
          <span className="console-pr-section-state">draft</span>
        )}
        <ConsolePullRequestStatusBadges
          mergeableStatus={pullRequest.mergeableStatus}
          isPassedAllCiJob={pullRequest.isPassedAllCiJob}
          isCiStateSuccess={pullRequest.isCiStateSuccess}
          isBranchOutOfDate={pullRequest.isBranchOutOfDate}
          missingRequiredCheckNames={pullRequest.missingRequiredCheckNames}
        />
        <ConsoleCopyUrlButton url={pullRequest.url} label="Copy PR URL" />
        <div className="console-pr-statbar">
          {pullRequest.branchName !== null && (
            <span className="console-pr-branch">{pullRequest.branchName}</span>
          )}
          {summary !== null && (
            <>
              <span className="console-pr-add">+{summary.additions}</span>
              <span className="console-pr-del">-{summary.deletions}</span>
              <span className="console-pr-files-count">
                {summary.changedFiles} files
              </span>
            </>
          )}
        </div>
      </div>
      <ConsolePanel title="Description" defaultCollapsed>
        {bodyIsLoading ? (
          <p className="console-pr-body-loading">Loading description...</p>
        ) : (
          <ConsoleMarkdownContent
            body={summary?.body ?? body}
            buildImageProxyUrl={buildImageProxyUrl}
            renderReferenceLink={renderReferenceLink}
          />
        )}
      </ConsolePanel>
      <ConsolePanel title="Changed files" count={filesCount}>
        <ConsoleChangedFileList
          files={files}
          isLoading={filesAreLoading}
          error={filesError}
          onAddInlineComment={onAddInlineComment}
        />
      </ConsolePanel>
      <ConsolePanel title="Commits" count={commitsCount} defaultCollapsed>
        <ConsoleCommitList
          commits={commits}
          isLoading={commitsAreLoading}
          error={commitsError}
          now={now}
        />
      </ConsolePanel>
    </>
  );
};
