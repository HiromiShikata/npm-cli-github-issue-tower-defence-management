import { useCallback } from 'react';
import { ConsoleCommentComposer } from '../components/detail/ConsoleCommentComposer';
import { ConsoleItemDetail } from '../components/detail/ConsoleItemDetail';
import { ConsoleOperationMenu } from '../components/operations/ConsoleOperationMenu';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleItemDetailData } from '../hooks/useConsoleItemDetailData';
import type { ConsoleOperationsApi } from '../hooks/useConsoleOperations';
import { useConsoleToken } from '../hooks/useConsoleToken';
import { buildImageProxyUrl } from '../lib/imageProxy';
import type { ConsoleActionKind } from '../logic/actionToast';
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

export type ConsoleQueueActionInput = {
  kind: ConsoleActionKind;
  item: ConsoleListItem;
  commit: () => void;
};

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
  onQueueAction: (input: ConsoleQueueActionInput) => void;
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
  onQueueAction,
}: ConsoleItemDetailContainerProps) => {
  const detail = useConsoleItemDetailData(caches, item);
  const { token } = useConsoleToken();
  const resolveImageProxyUrl = useCallback(
    (src: string): string => buildImageProxyUrl(src, token),
    [token],
  );
  const hasPullRequest = item.isPr || detail.relatedPullRequests.length > 0;

  const handlers: ConsoleOperationHandlers = {
    onReview: (action) => {
      const prUrl = item.isPr
        ? item.url
        : (detail.relatedPullRequests[0]?.pullRequest.url ?? item.url);
      onQueueAction({
        kind: { type: 'review', action },
        item,
        commit: () => {
          void operations.reviewPullRequest(item, prUrl, action);
        },
      });
    },
    onSetNextActionDate: (action) => {
      onQueueAction({
        kind: { type: 'next_action_date', action },
        item,
        commit: () => {
          void operations.setNextActionDate(item, action);
        },
      });
    },
    onSetStory: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_story', optionName: option.name },
        item,
        commit: () => {
          void operations.setStory(item, option);
        },
      });
    },
    onSetStatus: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_status', optionName: option.name },
        item,
        commit: () => {
          void operations.setStatus(item, option);
        },
      });
    },
    onSetInTmuxByHuman: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_in_tmux_by_human', optionName: option.name },
        item,
        commit: () => {
          void operations.setInTmuxByHuman(item, option);
        },
      });
    },
    onClose: (action) => {
      onQueueAction({
        kind: { type: 'close', action },
        item,
        commit: () => {
          void operations.closeIssue(item, action);
        },
      });
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
      buildImageProxyUrl={resolveImageProxyUrl}
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
