import type {
  ConsoleChangedFile,
  ConsoleCommit,
  ConsoleRelatedPullRequest,
} from '../types';
import { ConsoleChangedFileList } from './ConsoleChangedFileList';
import { ConsoleCommitList } from './ConsoleCommitList';
import { ConsoleMarkdownView } from './ConsoleMarkdownView';
import { ConsolePanel } from './ConsolePanel';

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
};

export const ConsolePullRequestSection = ({
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
}: ConsolePullRequestSectionProps) => {
  const summary = pullRequest.summary;
  return (
    <section className="console-pr-section">
      <header className="console-pr-section-header">
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
      </header>
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
      {bodyIsLoading ? (
        <p className="console-pr-body-loading">Loading description...</p>
      ) : (
        <ConsoleMarkdownView body={summary?.body ?? body} />
      )}
      <ConsolePanel title="Changed files">
        <ConsoleChangedFileList
          files={files}
          isLoading={filesAreLoading}
          error={filesError}
        />
      </ConsolePanel>
      <ConsolePanel title="Commits" defaultCollapsed>
        <ConsoleCommitList
          commits={commits}
          isLoading={commitsAreLoading}
          error={commitsError}
          now={now}
        />
      </ConsolePanel>
    </section>
  );
};
