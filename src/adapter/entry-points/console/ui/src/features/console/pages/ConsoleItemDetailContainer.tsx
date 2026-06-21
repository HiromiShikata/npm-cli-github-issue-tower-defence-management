import { ConsoleCommentComposer } from '../components/detail/ConsoleCommentComposer';
import { ConsoleItemDetail } from '../components/detail/ConsoleItemDetail';
import { ConsoleOperationMenu } from '../components/operations/ConsoleOperationMenu';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleItemDetailData } from '../hooks/useConsoleItemDetailData';
import type { ConsoleOperationsApi } from '../hooks/useConsoleOperations';
import { resolveStoryColorEnum } from '../logic/grouping';
import type { ConsoleOperationHandlers } from '../logic/operations';
import type {
  ConsoleColor,
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleOverlayStatus,
  ConsoleStoryColorSource,
  ConsoleTabName,
} from '../logic/types';

export type ConsoleItemDetailContainerProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  caches: ConsoleCaches;
  operations: ConsoleOperationsApi;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  storyColors: ConsoleStoryColorSource;
  storyName: string | null;
  overlayStatus: ConsoleOverlayStatus | null;
  now: number;
};

export const ConsoleItemDetailContainer = ({
  tab,
  item,
  caches,
  operations,
  statusOptions,
  storyOptions,
  storyColors,
  storyName,
  overlayStatus,
  now,
}: ConsoleItemDetailContainerProps) => {
  const detail = useConsoleItemDetailData(caches, item);
  const hasPullRequest = item.isPr || detail.relatedPullRequests.length > 0;

  const handlers: ConsoleOperationHandlers = {
    onReview: (action) => {
      const prUrl = item.isPr
        ? item.url
        : (detail.relatedPullRequests[0]?.pullRequest.url ?? item.url);
      void operations.reviewPullRequest(item, prUrl, action);
    },
    onSetNextActionDate: (action) => {
      void operations.setNextActionDate(item, action);
    },
    onSetStory: (option: ConsoleFieldOption) => {
      void operations.setStory(item, option);
    },
    onSetStatus: (option: ConsoleFieldOption) => {
      void operations.setStatus(item, option);
    },
    onSetInTmuxByHuman: (option: ConsoleFieldOption) => {
      void operations.setInTmuxByHuman(item, option);
    },
    onClose: (action) => {
      void operations.closeIssue(item, action);
    },
  };

  const resolvedStoryName =
    storyName ?? (item.story.trim() !== '' ? item.story : null);
  const storyColorEnum: ConsoleColor | null =
    resolvedStoryName !== null
      ? resolveStoryColorEnum(storyColors, resolvedStoryName)
      : null;

  return (
    <ConsoleItemDetail
      item={item}
      storyName={resolvedStoryName}
      storyColorEnum={storyColorEnum}
      overlayStatus={overlayStatus}
      state={detail.state}
      body={detail.body}
      bodyIsLoading={detail.bodyIsLoading}
      bodyError={detail.bodyError}
      comments={detail.comments}
      commentsAreLoading={detail.commentsAreLoading}
      commentsError={detail.commentsError}
      files={detail.files}
      filesAreLoading={detail.filesAreLoading}
      filesError={detail.filesError}
      commits={detail.commits}
      commitsAreLoading={detail.commitsAreLoading}
      commitsError={detail.commitsError}
      relatedPullRequests={detail.relatedPullRequests}
      now={now}
      commentComposer={
        <ConsoleCommentComposer
          isPr={item.isPr}
          now={now}
          onSubmit={(body) => operations.addComment(item, body)}
        />
      }
      operationBar={
        <ConsoleOperationMenu
          tab={tab}
          item={item}
          hasPullRequest={hasPullRequest}
          statusOptions={statusOptions}
          storyOptions={storyOptions}
          handlers={handlers}
        />
      }
    />
  );
};
