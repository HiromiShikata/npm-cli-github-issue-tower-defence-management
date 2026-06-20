import { formatRelativeTime } from '../../logic/relativeTime';
import type { ConsoleCommit } from '../../logic/types';

export type ConsoleCommitListProps = {
  commits: ConsoleCommit[];
  isLoading: boolean;
  error: string | null;
  now: number;
};

const shortSha = (sha: string): string => sha.slice(0, 7);

const firstLine = (message: string): string => message.split('\n')[0];

export const ConsoleCommitList = ({
  commits,
  isLoading,
  error,
  now,
}: ConsoleCommitListProps) => {
  if (error !== null) {
    return (
      <p role="alert" className="console-commits-error">
        Failed to load commits: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="console-commits-loading">Loading commits...</p>;
  }

  if (commits.length === 0) {
    return <p className="console-commits-empty">No commits.</p>;
  }

  return (
    <ul className="console-commits">
      {commits.map((commit) => (
        <li key={commit.sha} className="console-commit">
          <span className="console-commit-message">
            {firstLine(commit.message)}
          </span>
          <span className="console-commit-sha">{shortSha(commit.sha)}</span>
          <span className="console-commit-author">{commit.author}</span>
          <span className="console-commit-time">
            {formatRelativeTime(commit.authoredAt, now)}
          </span>
        </li>
      ))}
    </ul>
  );
};
