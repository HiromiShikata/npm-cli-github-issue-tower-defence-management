import { useCallback, useRef, useState } from 'react';
import {
  ConsoleCommentComposer,
  type ConsoleCommentSubmitResult,
} from '../components/detail/ConsoleCommentComposer';
import type { ConsoleAddInlineComment } from '../components/detail/ConsoleFileDiff';
import { ConsoleItemDetail } from '../components/detail/ConsoleItemDetail';
import type { IssueCreateParams } from '../components/layout/IssueCreateModalDialog';
import { ConsoleOperationMenu } from '../components/operations/ConsoleOperationMenu';
import {
  ConsoleActionPartiallySentError,
  type ConsoleActionQueue,
  type ConsoleOfflinePayload,
  consoleActionStepsRun,
  isNetworkError,
} from '../hooks/useConsoleActionQueue';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleItemDetailData } from '../hooks/useConsoleItemDetailData';
import {
  AWAITING_WORKSPACE_COMMENT_BODY,
  buildIntmuxRequest,
  buildTriageRequest,
  type ConsoleOperationsApi,
  commentRequestBuild,
  deleteAllCommentsRequestBuild,
  INTMUX_OPERATION_PATH,
  REVIEW_OPERATION_PATH,
  reviewRequest,
  TRIAGE_OPERATION_PATH,
} from '../hooks/useConsoleOperations';
import {
  COMMENT_OPERATION_PATH,
  DELETE_ALL_COMMENTS_OPERATION_PATH,
} from '../lib/consoleApi';
import { buildImageProxyUrl } from '../lib/imageProxy';
import {
  isMarkdownCheckboxCheckedAtIndex,
  toggleMarkdownCheckboxAtIndex,
} from '../lib/markdownCheckboxToggle';
import { type ConsoleActionKind, itemToastLabel } from '../logic/actionToast';
import { resolveStoryColorEnum } from '../logic/grouping';
import {
  AWAITING_WORKSPACE_NAME,
  type ConsoleCloseAction,
  type ConsoleNextActionDateAction,
  type ConsoleOperationHandlers,
  type ConsolePendingReviewComment,
  type ConsoleReviewAction,
} from '../logic/operations';
import { mergePostedComments } from '../logic/postedComments';
import type {
  ConsoleColor,
  ConsoleComment,
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleOverlayEntry,
  ConsoleOverlayStatus,
  ConsoleStoryColorSource,
  ConsoleStoryEntry,
  ConsoleTabName,
} from '../logic/types';
import { ConsoleReferenceLinkContainer } from './ConsoleReferenceLinkContainer';

export type ConsoleCommentErrorHandler = (
  message: string,
  reason: string,
) => void;

export type ConsoleQueueActionInput = {
  kind: ConsoleActionKind;
  item: ConsoleListItem;
  commit: (sentStepCount: number) => Promise<void>;
  offline?: ConsoleOfflinePayload[];
  skipAdvance?: boolean;
  onAdvance?: () => void;
  revertAdvance?: () => void;
  overlayPatch?: Partial<Omit<ConsoleOverlayEntry, 'ts' | 'mode'>>;
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
    | 'set_agent'
    | 'set_status',
  extra?: {
    statusName?: string;
    storyOptionId?: string;
    agentOptionId?: string;
  },
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: TRIAGE_OPERATION_PATH,
  requestBody: buildTriageRequest(
    pjcode,
    item,
    action,
    extra,
  ) as unknown as Record<string, unknown>,
});

const buildIntmuxOfflinePayload = (
  pjcode: string,
  item: ConsoleListItem,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: INTMUX_OPERATION_PATH,
  requestBody: buildIntmuxRequest(pjcode, item),
});

const commentOfflinePayloadBuild = (
  pjcode: string,
  item: ConsoleListItem,
  body: string,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: COMMENT_OPERATION_PATH,
  requestBody: commentRequestBuild(pjcode, item, body),
});

const deleteAllCommentsOfflinePayloadBuild = (
  item: ConsoleListItem,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: DELETE_ALL_COMMENTS_OPERATION_PATH,
  requestBody: deleteAllCommentsRequestBuild(item),
});

export const okAndAwaitingWorkspaceOfflinePayloadsBuild = (
  pjcode: string,
  item: ConsoleListItem,
  option: ConsoleFieldOption,
): ConsoleOfflinePayload[] => [
  commentOfflinePayloadBuild(pjcode, item, AWAITING_WORKSPACE_COMMENT_BODY),
  buildTriageOfflinePayload(pjcode, item, 'set_status', {
    statusName: option.name,
  }),
];

const COMMENT_HELD_OFFLINE_TOAST_COLOR = 'blue';

const commentHeldOfflineToastMessage = (item: ConsoleListItem): string =>
  `Commented — ${itemToastLabel(item)}`;

const OK_AND_CLOSE_COMMENT_BODY = 'ok';

const notifyCommentError = (
  onCommentError: ConsoleCommentErrorHandler | undefined,
  message: string,
  cause: unknown,
): void => {
  if (onCommentError !== undefined) {
    onCommentError(message, String(cause));
  } else {
    console.error(message, cause);
  }
};

export type ConsoleItemDetailContainerProps = {
  tab: ConsoleTabName;
  item: ConsoleListItem;
  caches: ConsoleCaches;
  operations: ConsoleOperationsApi;
  pjcode?: string | null;
  isAirplaneModeOn: boolean;
  onOfflineActionsCreate: ConsoleActionQueue['offlineActionsCreate'];
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  agentOptions: ConsoleFieldOption[];
  storyColors: ConsoleStoryColorSource;
  storyName: string | null;
  storyOptionId?: string | null;
  overlayStatus: ConsoleOverlayStatus | null;
  now: number;
  initialCommentDraft?: string;
  onCommentDraftChange?: (draft: string) => void;
  onQueueAction: (input: ConsoleQueueActionInput) => void;
  onCommentError?: ConsoleCommentErrorHandler;
  onDeleteStory?: ((deleteChildTasks: boolean) => Promise<void>) | null;
  storyNameForDeletion?: string | null;
  storyEntries?: ConsoleStoryEntry[];
  onCreateIssueFromComment?: {
    onSubmitProject: (params: IssueCreateParams) => Promise<void>;
    onSubmitWorkflow: (params: IssueCreateParams) => Promise<void>;
  };
};

const reconcileCheckboxToConfirmedState = (
  source: string,
  checkboxIndex: number,
  confirmedChecked: boolean,
): string =>
  isMarkdownCheckboxCheckedAtIndex(source, checkboxIndex) === confirmedChecked
    ? source
    : toggleMarkdownCheckboxAtIndex(source, checkboxIndex);

export const ConsoleItemDetailContainer = ({
  tab,
  item,
  caches,
  operations,
  pjcode,
  isAirplaneModeOn,
  onOfflineActionsCreate,
  statusOptions,
  storyOptions,
  agentOptions,
  storyColors,
  storyName,
  storyOptionId,
  overlayStatus,
  now,
  initialCommentDraft,
  onCommentDraftChange,
  onQueueAction,
  onCommentError,
  onDeleteStory,
  storyNameForDeletion,
  storyEntries,
  onCreateIssueFromComment,
}: ConsoleItemDetailContainerProps) => {
  const detail = useConsoleItemDetailData(caches, item, tab);
  const resolveImageProxyUrl = useCallback(
    (src: string): string => buildImageProxyUrl(src, item.url),
    [item.url],
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
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [commentBodyOverrides, setCommentBodyOverrides] = useState<
    Record<number, string>
  >({});
  const bodyCheckboxConfirmedRef = useRef<Record<number, boolean>>({});
  const commentCheckboxConfirmedRef = useRef<Record<string, boolean>>({});
  const addComment = useCallback(
    async (body: string): Promise<ConsoleCommentSubmitResult> => {
      const commentHoldOffline = (
        projectCode: string,
      ): ConsoleCommentSubmitResult => {
        onOfflineActionsCreate({
          payloads: [commentOfflinePayloadBuild(projectCode, item, body)],
          message: commentHeldOfflineToastMessage(item),
          color: COMMENT_HELD_OFFLINE_TOAST_COLOR,
        });
        return 'held_offline';
      };
      if (isAirplaneModeOn && pjcode != null) {
        return commentHoldOffline(pjcode);
      }
      try {
        const comment = await operations.addComment(item, body);
        setPostedComments((previous) => [...previous, comment]);
        return comment;
      } catch (cause) {
        if (isNetworkError(cause) && pjcode != null) {
          return commentHoldOffline(pjcode);
        }
        throw cause;
      }
    },
    [isAirplaneModeOn, item, onOfflineActionsCreate, operations, pjcode],
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
            ? [
                buildReviewOfflinePayload(
                  pjcode,
                  item,
                  prUrl,
                  action,
                  reviewComments,
                ),
              ]
            : undefined,
        overlayPatch: { done: true },
      });
    },
    onSetNextActionDate: (action) => {
      onQueueAction({
        kind: { type: 'next_action_date', action },
        item,
        commit: () => operations.setNextActionDate(item, action),
        offline:
          pjcode != null
            ? [buildTriageOfflinePayload(pjcode, item, action)]
            : undefined,
        overlayPatch: { done: true },
      });
    },
    onSetStory: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_story', optionName: option.name },
        item,
        commit: () => operations.setStory(item, option),
        offline:
          pjcode != null
            ? [
                buildTriageOfflinePayload(pjcode, item, 'set_story', {
                  storyOptionId: option.id,
                }),
              ]
            : undefined,
        overlayPatch: {
          done: true,
          story: { id: option.id, name: option.name, color: option.color },
        },
      });
    },
    onSetAgent: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_agent', optionName: option.name },
        item,
        commit: () => operations.setAgent(item, option),
        offline:
          pjcode != null
            ? [
                buildTriageOfflinePayload(pjcode, item, 'set_agent', {
                  agentOptionId: option.id,
                }),
              ]
            : undefined,
        overlayPatch: { done: true },
      });
    },
    onSetStatus: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_status', optionName: option.name },
        item,
        commit: () => operations.setStatus(item, option),
        offline:
          pjcode != null
            ? [
                buildTriageOfflinePayload(pjcode, item, 'set_status', {
                  statusName: option.name,
                }),
              ]
            : undefined,
        overlayPatch: {
          done: true,
          status: { name: option.name, color: option.color },
        },
      });
    },
    onSetInTmuxByHuman: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'set_in_tmux_by_human', optionName: option.name },
        item,
        commit: () => operations.setInTmuxByHuman(item, option),
        offline:
          pjcode != null
            ? [buildIntmuxOfflinePayload(pjcode, item)]
            : undefined,
        overlayPatch: {
          done: true,
          status: { name: option.name, color: option.color },
        },
      });
    },
    onClose: (action) => {
      onQueueAction({
        kind: { type: 'close', action },
        item,
        commit: () => operations.closeIssue(item, action),
        offline:
          pjcode != null
            ? [buildTriageOfflinePayload(pjcode, item, action)]
            : undefined,
        overlayPatch: { done: true },
      });
    },
    onOkAndAwaitingWorkspace: (option: ConsoleFieldOption) => {
      onQueueAction({
        kind: { type: 'ok_and_awaiting_workspace' },
        item,
        commit: (sentStepCount) =>
          operations.okAndMoveToAwaitingWorkspace(item, option, sentStepCount),
        offline:
          pjcode != null
            ? okAndAwaitingWorkspaceOfflinePayloadsBuild(pjcode, item, option)
            : undefined,
        overlayPatch: {
          done: true,
          status: { name: option.name, color: option.color },
        },
      });
    },
    onDeleteAllComments: () => {
      onQueueAction({
        kind: { type: 'delete_all_comments' },
        item,
        commit: () => operations.deleteAllComments(item),
        offline: [deleteAllCommentsOfflinePayloadBuild(item)],
      });
    },
    onDeleteStory: onDeleteStory ?? null,
    onSetDependedIssueUrl:
      pjcode != null
        ? async (dependedIssueUrl: string) => {
            await operations.setDependedIssueUrl(item, dependedIssueUrl);
          }
        : null,
  };

  const issueRename = useCallback(
    async (newTitle: string) => {
      await operations.issueRename(item, newTitle);
    },
    [item, operations],
  );

  const toggleBodyCheckbox = useCallback(
    (checkboxIndex: number) => {
      const currentBody = bodyOverride ?? detail.body;
      const newBody = toggleMarkdownCheckboxAtIndex(currentBody, checkboxIndex);
      const newChecked = isMarkdownCheckboxCheckedAtIndex(
        newBody,
        checkboxIndex,
      );
      setBodyOverride(newBody);
      const reconcileToConfirmed = () => {
        const confirmedChecked =
          bodyCheckboxConfirmedRef.current[checkboxIndex] ??
          isMarkdownCheckboxCheckedAtIndex(detail.body, checkboxIndex);
        setBodyOverride((latest) =>
          reconcileCheckboxToConfirmedState(
            latest ?? detail.body,
            checkboxIndex,
            confirmedChecked,
          ),
        );
      };
      operations.issueBodyUpdate?.(item, newBody).then(
        () => {
          bodyCheckboxConfirmedRef.current[checkboxIndex] = newChecked;
          reconcileToConfirmed();
        },
        (cause: unknown) => {
          reconcileToConfirmed();
          console.error('Failed to persist description checkbox toggle', cause);
        },
      );
    },
    [bodyOverride, detail.body, item, operations],
  );

  const toggleCommentCheckbox = useCallback(
    (comment: ConsoleComment, checkboxIndex: number) => {
      const currentBody = commentBodyOverrides[comment.id] ?? comment.body;
      const newBody = toggleMarkdownCheckboxAtIndex(currentBody, checkboxIndex);
      const newChecked = isMarkdownCheckboxCheckedAtIndex(
        newBody,
        checkboxIndex,
      );
      setCommentBodyOverrides((previous) => ({
        ...previous,
        [comment.id]: newBody,
      }));
      const generationKey = `${comment.id}:${checkboxIndex}`;
      const reconcileToConfirmed = () => {
        const confirmedChecked =
          commentCheckboxConfirmedRef.current[generationKey] ??
          isMarkdownCheckboxCheckedAtIndex(comment.body, checkboxIndex);
        setCommentBodyOverrides((previous) => ({
          ...previous,
          [comment.id]: reconcileCheckboxToConfirmedState(
            previous[comment.id] ?? comment.body,
            checkboxIndex,
            confirmedChecked,
          ),
        }));
      };
      operations.issueCommentBodyUpdate?.(item, comment.id, newBody).then(
        () => {
          commentCheckboxConfirmedRef.current[generationKey] = newChecked;
          reconcileToConfirmed();
        },
        (cause: unknown) => {
          reconcileToConfirmed();
          console.error('Failed to persist comment checkbox toggle', cause);
        },
      );
    },
    [commentBodyOverrides, item, operations],
  );

  const awaitingWorkspaceOption =
    statusOptions.find((o) => o.name === AWAITING_WORKSPACE_NAME) ?? null;

  const addCommentAndMoveToAwaitingWorkspace =
    awaitingWorkspaceOption !== null
      ? async (body: string): Promise<ConsoleCommentSubmitResult> => {
          onCommentDraftChange?.('');
          return await new Promise<ConsoleCommentSubmitResult>(
            (resolve, reject) => {
              let commentPostAssumedAlreadySucceededSoRetryOnlyUpdatesStatus = false;
              const rejectWithMessage = (message: string, cause: unknown) => {
                notifyCommentError(onCommentError, message, cause);
                reject(cause);
                throw cause;
              };
              onQueueAction({
                kind: {
                  type: 'set_status',
                  optionName: awaitingWorkspaceOption.name,
                },
                item,
                commit: async (sentStepCount) => {
                  if (
                    sentStepCount > 0 ||
                    commentPostAssumedAlreadySucceededSoRetryOnlyUpdatesStatus
                  ) {
                    try {
                      await operations.setStatus(item, awaitingWorkspaceOption);
                    } catch (cause) {
                      if (isNetworkError(cause) && pjcode != null) {
                        throw new ConsoleActionPartiallySentError(1, cause);
                      }
                      rejectWithMessage(
                        `Comment already posted, but retrying the move to Awaiting Workspace status failed: ${String(cause)}`,
                        cause,
                      );
                    }
                    try {
                      await operations.onAfterMoveToAwaitingWorkspace?.();
                    } catch (cause) {
                      const message = `Comment posted and status set to Awaiting Workspace, but a post-success refresh action failed: ${String(cause)}`;
                      notifyCommentError(onCommentError, message, cause);
                    }
                    return;
                  }
                  try {
                    const comment =
                      await operations.addCommentAndMoveToAwaitingWorkspace(
                        item,
                        body,
                        awaitingWorkspaceOption,
                      );
                    setPostedComments((previous) => [...previous, comment]);
                    resolve(comment);
                  } catch (cause) {
                    const isCommentPosted =
                      cause instanceof ConsoleActionPartiallySentError;
                    const unsentRequestFailure = isCommentPosted
                      ? cause.cause
                      : cause;
                    if (
                      isNetworkError(unsentRequestFailure) &&
                      pjcode != null
                    ) {
                      resolve('held_offline');
                      throw cause;
                    }
                    commentPostAssumedAlreadySucceededSoRetryOnlyUpdatesStatus = true;
                    if (isCommentPosted) {
                      reject(cause);
                      throw cause;
                    }
                    rejectWithMessage(
                      `Comment may already be posted; moving to Awaiting Workspace status failed: ${String(cause)}`,
                      cause,
                    );
                  }
                },
                offline:
                  pjcode != null
                    ? [
                        commentOfflinePayloadBuild(pjcode, item, body),
                        buildTriageOfflinePayload(pjcode, item, 'set_status', {
                          statusName: awaitingWorkspaceOption.name,
                        }),
                      ]
                    : undefined,
                overlayPatch: {
                  done: true,
                  status: {
                    name: awaitingWorkspaceOption.name,
                    color: awaitingWorkspaceOption.color,
                  },
                },
              });
              if (isAirplaneModeOn && pjcode != null) {
                resolve('held_offline');
              }
            },
          );
        }
      : undefined;

  const commentDraftRef = useRef<string>('');
  const [isDraftEmpty, setIsDraftEmpty] = useState<boolean>(
    (initialCommentDraft ?? '').trim().length === 0,
  );
  const [isCommentComposerOpen, setIsCommentComposerOpen] =
    useState<boolean>(true);

  const handleDraftChange = useCallback(
    (draft: string) => {
      commentDraftRef.current = draft;
      setIsDraftEmpty(draft.trim().length === 0);
      onCommentDraftChange?.(draft);
    },
    [onCommentDraftChange],
  );

  const commentAndClose = async (body: string): Promise<void> => {
    if (pjcode == null) {
      await addComment(body);
      handlers.onClose('close');
      return;
    }
    onQueueAction({
      kind: { type: 'close', action: 'close' },
      item,
      commit: (sentStepCount) =>
        consoleActionStepsRun(
          [
            async () => {
              const comment = await operations.addComment(item, body);
              setPostedComments((previous) => [...previous, comment]);
            },
            () => operations.closeIssue(item, 'close'),
          ],
          sentStepCount,
        ),
      offline: [
        commentOfflinePayloadBuild(pjcode, item, body),
        buildTriageOfflinePayload(pjcode, item, 'close'),
      ],
      overlayPatch: { done: true },
    });
  };

  const commentAndCloseWithDraft = async (): Promise<void> => {
    const body = commentDraftRef.current.trim();
    if (body.length === 0) return;
    await commentAndClose(body);
  };

  const okAndClose = async (): Promise<void> => {
    onQueueAction({
      kind: { type: 'ok_and_close' },
      item,
      commit: (sentStepCount) =>
        consoleActionStepsRun(
          [
            async () => {
              await operations.addComment(item, OK_AND_CLOSE_COMMENT_BODY);
            },
            () => operations.closeIssue(item, 'close'),
          ],
          sentStepCount,
        ),
      offline:
        pjcode != null
          ? [
              commentOfflinePayloadBuild(
                pjcode,
                item,
                OK_AND_CLOSE_COMMENT_BODY,
              ),
              buildTriageOfflinePayload(pjcode, item, 'close'),
            ]
          : undefined,
      overlayPatch: { done: true },
    });
  };

  const resolvedStoryName =
    storyName ?? (item.story.trim() !== '' ? item.story : null);
  const storyColorEnum: ConsoleColor | null =
    storyOptionId != null
      ? resolveStoryColorEnum(storyColors, storyOptionId)
      : null;
  const resolvedStoryOptionId = storyOptionId ?? item.storyOptionId ?? null;

  const displayedBody = bodyOverride ?? detail.body;
  const displayedComments = mergePostedComments(
    detail.comments,
    postedComments,
  ).map((comment) =>
    commentBodyOverrides[comment.id] !== undefined
      ? { ...comment, body: commentBodyOverrides[comment.id] }
      : comment,
  );

  return (
    <ConsoleItemDetail
      item={item}
      storyName={resolvedStoryName}
      storyColorEnum={storyColorEnum}
      overlayStatus={overlayStatus}
      statusOptions={statusOptions}
      state={detail.state}
      stateError={detail.stateError}
      body={displayedBody}
      bodyIsLoading={detail.bodyIsLoading}
      bodyError={detail.bodyError}
      comments={displayedComments}
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
      onTitleRename={issueRename}
      onBodyCheckboxToggle={toggleBodyCheckbox}
      onCommentCheckboxToggle={toggleCommentCheckbox}
      storyEntries={storyEntries}
      agentOptions={agentOptions}
      onCreateIssueFromComment={onCreateIssueFromComment}
      commentComposer={
        <ConsoleCommentComposer
          initiallyOpen
          initialDraft={initialCommentDraft}
          onSubmit={addComment}
          onDraftChange={handleDraftChange}
          onOkAndAwaitingWorkspace={
            awaitingWorkspaceOption !== null
              ? () => handlers.onOkAndAwaitingWorkspace(awaitingWorkspaceOption)
              : undefined
          }
          onSubmitAndMoveToAwaitingWorkspace={
            addCommentAndMoveToAwaitingWorkspace
          }
          onUploadFile={(file) => operations.uploadAttachment(item, file)}
          onOpenChange={setIsCommentComposerOpen}
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
          currentStoryName={resolvedStoryName}
          currentStoryOptionId={resolvedStoryOptionId}
          agentOptions={agentOptions}
          currentAgentName={item.agent}
          currentAgentOptionId={item.agentOptionId ?? null}
          handlers={handlers}
          storyNameForDeletion={storyNameForDeletion}
          onCommentAndClose={commentAndCloseWithDraft}
          onOkAndClose={okAndClose}
          isDraftEmpty={isDraftEmpty}
          isVisible={isCommentComposerOpen}
        />
      }
    />
  );
};
