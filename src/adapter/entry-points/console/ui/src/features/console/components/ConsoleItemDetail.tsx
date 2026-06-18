import { Badge } from '@/components/ui/badge';
import type {
  ConsoleCloseEvent,
  ConsoleComment,
  ConsoleFieldOption,
  ConsoleListItem,
  ConsolePullRequestDetail,
  ConsoleRelatedPullRequest,
  ConsoleReviewEvent,
  ConsoleSnoozeEvent,
  ConsoleTabName,
} from '../types';
import { ConsoleCommentList } from './ConsoleCommentList';
import { ConsoleItemIcon } from './ConsoleItemIcon';
import { ConsoleOperationBar } from './ConsoleOperationBar';
import { MarkdownView } from './MarkdownView';
import { PullRequestSection } from './PullRequestSection';

export type ConsoleItemDetailProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  body: string;
  isBodyLoading: boolean;
  bodyError: string | null;
  comments: ConsoleComment[];
  areCommentsLoading: boolean;
  commentsError: string | null;
  pullRequestDetail: ConsolePullRequestDetail | null;
  relatedPullRequests: ConsoleRelatedPullRequest[];
  isPullRequestLoading: boolean;
  pullRequestError: string | null;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  onReview: (event: ConsoleReviewEvent) => void;
  onSnooze: (event: ConsoleSnoozeEvent) => void;
  onSetStory: (option: ConsoleFieldOption) => void;
  onSetStatus: (option: ConsoleFieldOption) => void;
  onSetInTmux: (option: ConsoleFieldOption) => void;
  onClose: (event: ConsoleCloseEvent) => void;
};

export const ConsoleItemDetail = ({
  tab,
  item,
  body,
  isBodyLoading,
  bodyError,
  comments,
  areCommentsLoading,
  commentsError,
  pullRequestDetail,
  relatedPullRequests,
  isPullRequestLoading,
  pullRequestError,
  statusOptions,
  storyOptions,
  onReview,
  onSnooze,
  onSetStory,
  onSetStatus,
  onSetInTmux,
  onClose,
}: ConsoleItemDetailProps) => {
  const hasReviewTarget = item.isPr || relatedPullRequests.length > 0;

  return (
    <article className="flex flex-col">
      <header className="flex flex-col gap-1 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <ConsoleItemIcon
            isPr={item.isPr}
            state={item.state}
            stateReason={item.stateReason}
          />
          <a
            href={item.url}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {item.title}
          </a>
          <span className="text-sm text-muted-foreground">#{item.number}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{item.repo}</Badge>
          {item.labels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-4 p-3">
        <section>
          {bodyError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              Could not load body: {bodyError}
            </p>
          ) : isBodyLoading ? (
            <p className="text-sm text-muted-foreground">Loading body…</p>
          ) : (
            <MarkdownView source={body} />
          )}
        </section>

        {hasReviewTarget && (
          <PullRequestSection
            detail={pullRequestDetail}
            relatedPullRequests={relatedPullRequests}
            isLoading={isPullRequestLoading}
            error={pullRequestError}
          />
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Comments</h3>
          <ConsoleCommentList
            comments={comments}
            isLoading={areCommentsLoading}
            error={commentsError}
          />
        </section>
      </div>

      <ConsoleOperationBar
        tab={tab}
        isPr={item.isPr}
        hasReviewTarget={hasReviewTarget}
        statusOptions={statusOptions}
        storyOptions={storyOptions}
        onReview={onReview}
        onSnooze={onSnooze}
        onSetStory={onSetStory}
        onSetStatus={onSetStatus}
        onSetInTmux={onSetInTmux}
        onClose={onClose}
      />
    </article>
  );
};
