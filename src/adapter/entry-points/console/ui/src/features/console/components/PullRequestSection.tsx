import { Badge } from '@/components/ui/badge';
import type {
  ConsolePullRequestDetail,
  ConsoleRelatedPullRequest,
} from '../types';
import { ConsoleItemIcon } from './ConsoleItemIcon';
import { MarkdownView } from './MarkdownView';

export type PullRequestSectionProps = {
  detail: ConsolePullRequestDetail | null;
  relatedPullRequests: ConsoleRelatedPullRequest[];
  isLoading: boolean;
  error: string | null;
};

const formatDiffStat = (additions: number, deletions: number): string =>
  `+${additions} -${deletions}`;

export const PullRequestSection = ({
  detail,
  relatedPullRequests,
  isLoading,
  error,
}: PullRequestSectionProps) => {
  if (error !== null) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load pull request: {error}
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading pull request details…
      </p>
    );
  }

  if (detail === null) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      {relatedPullRequests.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">
            Related pull requests ({relatedPullRequests.length})
          </h3>
          <ul className="flex flex-col gap-1">
            {relatedPullRequests.map((pullRequest) => (
              <li
                key={pullRequest.url}
                className="flex items-center gap-2 text-sm"
              >
                <ConsoleItemIcon
                  isPr
                  state="open"
                  isDraft={pullRequest.isDraft}
                />
                <a
                  href={pullRequest.url}
                  className="underline-offset-2 hover:underline"
                >
                  {pullRequest.title}
                </a>
                <span className="text-xs text-muted-foreground">
                  #{pullRequest.number}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{detail.title}</h3>
          <Badge variant="outline">
            {detail.headRefName} → {detail.baseRefName}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {detail.changedFiles} files{' '}
            {formatDiffStat(detail.additions, detail.deletions)}
          </span>
        </div>
        <MarkdownView source={detail.body} emptyText="(no PR description)" />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">
          Changed files ({detail.files.length})
        </h3>
        {detail.files.map((file) => (
          <div key={file.filename} className="rounded-md border border-border">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">
              <span className="font-mono">{file.filename}</span>
              <Badge variant="secondary">{file.status}</Badge>
              <span className="text-muted-foreground">
                {formatDiffStat(file.additions, file.deletions)}
              </span>
            </div>
            {file.patch !== null && (
              <pre className="overflow-x-auto px-3 py-2 text-xs leading-relaxed">
                <code>{file.patch}</code>
              </pre>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">
          Commits ({detail.commits.length})
        </h3>
        <ul className="flex flex-col gap-1">
          {detail.commits.map((commit) => (
            <li key={commit.sha} className="text-sm">
              <span className="font-medium">{commit.message}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {commit.sha.slice(0, 7)}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {commit.author} · {new Date(commit.authoredAt).toISOString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
