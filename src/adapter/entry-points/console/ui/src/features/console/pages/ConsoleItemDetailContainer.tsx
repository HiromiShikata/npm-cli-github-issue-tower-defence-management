import { ConsoleItemDetail } from '../components/ConsoleItemDetail';
import type { ConsoleApiClient } from '../hooks/consoleApiClient';
import type { ConsoleItemCache } from '../hooks/consoleItemCache';
import { useConsoleItemDetail } from '../hooks/useConsoleItemDetail';
import { useConsoleOperation } from '../hooks/useConsoleOperation';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleReviewTarget,
  ConsoleTabName,
} from '../types';

export type ConsoleItemDetailContainerProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  client: ConsoleApiClient;
  cache: ConsoleItemCache;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  onProcessed: (item: ConsoleListItem) => void;
  onAdvance: () => void;
};

export const ConsoleItemDetailContainer = ({
  tab,
  item,
  client,
  cache,
  statusOptions,
  storyOptions,
  onProcessed,
  onAdvance,
}: ConsoleItemDetailContainerProps) => {
  const detail = useConsoleItemDetail(cache, item);

  const reviewTarget: ConsoleReviewTarget | null = item.isPr
    ? { repo: item.repo, number: item.number }
    : (detail.relatedPullRequests[0] ?? null);

  const operations = useConsoleOperation({
    client,
    tab,
    item,
    reviewTarget,
    onProcessed,
    onAdvance,
  });

  return (
    <ConsoleItemDetail
      tab={tab}
      item={item}
      body={detail.body}
      isBodyLoading={detail.isBodyLoading}
      bodyError={detail.bodyError}
      comments={detail.comments}
      areCommentsLoading={detail.areCommentsLoading}
      commentsError={detail.commentsError}
      pullRequestDetail={detail.pullRequestDetail}
      relatedPullRequests={detail.relatedPullRequests}
      isPullRequestLoading={detail.isPullRequestLoading}
      pullRequestError={detail.pullRequestError}
      statusOptions={statusOptions}
      storyOptions={storyOptions}
      onReview={(event) => {
        void operations.onReview(event);
      }}
      onSnooze={(event) => {
        void operations.onSnooze(event);
      }}
      onSetStory={(option) => {
        void operations.onSetStory(option);
      }}
      onSetStatus={(option) => {
        void operations.onSetStatus(option);
      }}
      onSetInTmux={(option) => {
        void operations.onSetInTmux(option);
      }}
      onClose={(event) => {
        void operations.onClose(event);
      }}
    />
  );
};
