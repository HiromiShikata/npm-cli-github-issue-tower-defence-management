import { useCallback, useState } from 'react';
import { ConsoleCommentComposer } from '../components/detail/ConsoleCommentComposer';
import type { ConsoleAddInlineComment } from '../components/detail/ConsoleFileDiff';
import { ConsoleItemDetail } from '../components/detail/ConsoleItemDetail';
import { ConsoleOperationMenu } from '../components/operations/ConsoleOperationMenu';
import type { ConsoleOfflinePayload } from '../hooks/useConsoleActionQueue';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleItemDetailData } from '../hooks/useConsoleItemDetailData';
import {
  type ConsoleOperationsApi,
  INTMUX_OPERATION_PATH,
  REVIEW_OPERATION_PATH,
  reviewRequest,
  TRIAGE_OPERATION_PATH,
} from '../hooks/useConsoleOperations';
import { buildImageProxyUrl } from '../lib/imageProxy';
import type { ConsoleActionKind } from '../logic/actionToast';
import { resolveStoryColorEnum } from '../logic/grouping';
import type {
  ConsoleCloseAction,
  ConsoleNextActionDateAction,
  ConsoleOperationHandlers,
  ConsolePendingReviewComment,
  ConsoleReviewAction,
} from '../logic/operations';
import { mergePostedComments } from '../logic/postedComments';
import type {
  ConsoleColor,
  ConsoleComment,
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleOverlayStatus,
  ConsoleStoryColorSource,
  ConsoleTabName,
} from '../logic/types';
import { ConsoleReferenceLinkContainer } from './ConsoleReferenceLinkContainer';

export type ConsoleQueueActionInput = {
  kind: ConsoleActionKind;
  item: ConsoleListItem;
  commit: () => Promise<void>;
  offline?: ConsoleOfflinePayload;
};

const itemOfflineBase = (item: ConsoleListItem) => ({
  itemUrl: item.url,
  projectItemId: item.projectItemId,
  itemNumber: item.number,
  repo: item.repo,
  isPr: item.isPr,
});

const buildReviewOfflinePayload = (
  pjcode: string,
  item: ConsoleListItem,
  prUrl: string,
  action: ConsoleReviewAction,
  pendingComments: ConsolePendingReviewComment[],
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: REVIEW_OPERATION_PATH,
  requestBody: reviewRequest(
    pjcode,
    item,
    prUrl,
    action,
    pendingComments,
  ) as unknown as Record<string, unknown>,
});

const buildTriageOfflinePayload = (
  pjcode: string,
  item: ConsoleListItem,
  action:
    | ConsoleNextActionDateAction
    | ConsoleCloseAction
    | 'set_story'
    | 'set_status',
  extra?: { statusName?: string; storyOptionId?: string },
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: TRIAGE_OPERATION_PATH,
  requestBody: {
    pjcode,
    action,
    issueUrl: item.url,
    projectItemId: item.projectItemId,
    ...(extra ?? {}),
  },
});

const buildIntmuxOfflinePayload = (
  pjcode: string,
  item: ConsoleListItem,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: INTMUX_OPERATION_PATH,
  requestBody: {
    pjcode,
    action: 'set_intmux',
    issueUrl: item.url,
    projectItemId: item.projectItemId,
  },
});

export type ConsoleItemDetailContainerProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  caches: ConsoleCaches;
  operations: ConsoleOperationsApi;
  pjcode?: string | null;
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
  pjcode,
  statusOptions,
  storyOptions,
  storyColors,
  storyName,
  overlayStatus,
  now,
  onQueueAction,
}: ConsoleItemDetailContainerProps) => {
  const detail = useConsoleItemDetailData(caches, item);
  const resolveImageProxyUrl = useCallback(
    (src: string): string => buildImageProxyUrl(src),
    [],
  );
  const renderReferenceLink = useCallback(
    (href: string, fallbackText: string) => (
      <ConsoleReferenceLinkContainer
        cache={caches.state}
        href={href}
        fallbackText={fallbackText}
      />
    ),
    [caches.state],
  );
  const hasPullRequest =
    item.isPr ||
    item.relatedOpenPullRequestUrls.length > 0 ||
    detail.relatedPullRequests.length > 0;
  const [pendingReviewComments, setPendingReviewComments] = useState<
    ConsolePendingReviewComment[]
  >([]);
  const addInlineComment = useCallback<ConsoleAddInlineComment>(
    async (path, line, side, body) => {
      setPendingReviewComments((previous) => [
        ...previous,
        { path, line, side, body },
      ]);
    },
    [],
  );
  const [postedComments, setPostedComments] = useState<ConsoleComment[]>([]);
  const addComment = useCallback(
    async (body: string): Promise<ConsoleComment> => {
      const comment = await operations.addComment(item, body);
      setPostedComments((previous) => [...previous, comment]);
      return comment;
    },
    [item, operations],
  );

  const handlers: ConsoleOperationHandlers = {
    onReview: (action) => {
      const prUrl = item.isPr
        ? item.url
        : (detail.relatedPullRequests[0]?.pullRequest.url ??
          item.relatedOpenPullRequestUrls[0] ??
          item.url);
      const reviewComments =
        action === 'request_changes' ? pendingReviewComments : [];
      onQueueAction({
        kind: { type: 'review', action },
        item,
        commit: () =>
          operations.reviewPullRequest(item, prUrl, action, reviewComments),
        offline:
          pjcode != null
            ? buildReviewOfflinePayload(
                pjcode,
                item,
                prUrl,
                action,
                reviewComments,
              )
            : undefined,
      });
    },
    onSetNextActionDate: (action) => {
      onQueueAction({
        kind: { type: 'next_action_date', action },
        item,
        commit: () => operations.setNextActionDate(item, action),
        offline:
          pjcode != null
            ? buildTriageOfflinePayload(pjcode, item, action)
            : undefined,
      });
    },
    onSetStory: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_story', optionName: option.name },
        item,
        commit: () => operations.setStory(item, option),
        offline:
          pjcode != null
            ? buildTriageOfflinePayload(pjcode, item, 'set_story', {
                storyOptionId: option.id,
              })
            : undefined,
      });
    },
    onSetStatus: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_status', optionName: option.name },
        item,
        commit: () => operations.setStatus(item, option),
        offline:
          pjcode != null
            ? buildTriageOfflinePayload(pjcode, item, 'set_status', {
                statusName: option.name,
              })
            : undefined,
      });
    },
    onSetInTmuxByHuman: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_in_tmux_by_human', optionName: option.name },
        item,
        commit: () => operations.setInTmuxByHuman(item, option),
        offline:
          pjcode != null ? buildIntmuxOfflinePayload(pjcode, item) : undefined,
      });
    },
    onClose: (action) => {
      onQueueAction({
        kind: { type: 'close', action },
        item,
        commit: () => operations.closeIssue(item, action),
        offline:
          pjcode != null
            ? buildTriageOfflinePayload(pjcode, item, action)
            : undefined,
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
      statusOptions={statusOptions}
      state={detail.state}
      stateError={detail.stateError}
      body={detail.body}
      bodyIsLoading={detail.bodyIsLoading}
      bodyError={detail.bodyError}
      comments={mergePostedComments(detail.comments, postedComments)}
      commentsAreLoading={detail.commentsAreLoading}
      commentsError={detail.commentsError}
      files={detail.files}
      filesAreLoading={detail.filesAreLoading}
      filesError={detail.filesError}
      commits={detail.commits}
      commitsAreLoading={detail.commitsAreLoading}
      commitsError={detail.commitsError}
      pullRequestStatus={detail.pullRequestStatus}
      pullRequestStatusError={detail.pullRequestStatusError}
      relatedPullRequests={detail.relatedPullRequests}
      relatedPullRequestsError={detail.relatedPullRequestsError}
      now={now}
      buildImageProxyUrl={resolveImageProxyUrl}
      renderReferenceLink={renderReferenceLink}
      onAddInlineComment={addInlineComment}
      commentComposer={
        <ConsoleCommentComposer
          initiallyOpen
          onSubmit={addComment}
          onUploadFile={(file) => operations.uploadAttachment(item, file)}
        />
      }
      operationBar={
        <ConsoleOperationMenu
          tab={tab}
          item={item}
          hasPullRequest={hasPullRequest}
          rejectEnabled={pendingReviewComments.length > 0}
          statusOptions={statusOptions}
          storyOptions={storyOptions}
          handlers={handlers}
        />
      }
    />
  );
};
