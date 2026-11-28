import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConsoleCommentComposer,
  type ConsoleCommentSubmitResult,
} from '../components/detail/ConsoleCommentComposer';
import type { ConsoleAddInlineComment } from '../components/detail/ConsoleFileDiff';
import { ConsoleItemDetail } from '../components/detail/ConsoleItemDetail';
import type { IssueCreateParams } from '../components/layout/IssueCreateModalDialog';
import { ConsoleOperationMenu } from '../components/operations/ConsoleOperationMenu';
import {
  persistConsoleAction,
  removePersistedConsoleAction,
} from '../hooks/consoleActionDelivery';
import {
  ConsoleActionPartiallySentError,
  type ConsoleActionQueue,
  type ConsoleOfflinePayload,
  type ConsoleOfflineQueuedAction,
  type ConsoleUncommittedOutcome,
  consoleActionStepsRun,
  isHeldOfflineCommitFailure,
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
  SET_DEPENDED_ISSUE_URL_OPERATION_PATH,
} from '../lib/consoleApi';
import { buildImageProxyUrl } from '../lib/imageProxy';
import {
  isMarkdownCheckboxCheckedAtIndex,
  toggleMarkdownCheckboxAtIndex,
} from '../lib/markdownCheckboxToggle';
import { type ConsoleActionKind, itemToastLabel } from '../logic/actionToast';
import {
  loadCommentDrafts,
  mergeRestoredCommentDraft,
} from '../logic/commentDraftStorage';
import { consoleActionButtonLabels } from '../logic/consoleActionButtonLabels';
import {
  computeOpenedToActionMs,
  readConsoleItemOpenedAt,
  recordConsoleItemOpened,
} from '../logic/consoleItemOpenTimes';
import { parseDependedIssueUrlsInput } from '../logic/consoleStoryTaskPatch';
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
  ConsoleOverlayPatch,
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
  composerDraft?: { projectItemId: string; body: string };
  commit: (sentStepCount: number) => Promise<void>;
  onUncommitted?: (outcome: ConsoleUncommittedOutcome) => void;
  commitWithActionId?: (
    sentStepCount: number,
    actionId: string,
  ) => Promise<void>;
  offline?: ConsoleOfflinePayload[];
  skipAdvance?: boolean;
  onAdvance?: () => void;
  revertAdvance?: () => void;
  overlayPatch?: ConsoleOverlayPatch;
};

const itemOfflineBase = (item: ConsoleListItem) => ({
  itemUrl: item.url,
  projectItemId: item.projectItemId,
  itemNumber: item.number,
  repo: item.repo,
  nameWithOwner: item.nameWithOwner,
  isPr: item.isPr,
});

const buildReviewOfflinePayload = (
  pjcode: string,
  item: ConsoleListItem,
  prUrl: string,
  action: ConsoleReviewAction,
  pendingComments: ConsolePendingReviewComment[],
  actionId?: string,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: REVIEW_OPERATION_PATH,
  requestBody: reviewRequest(
    pjcode,
    item,
    prUrl,
    action,
    pendingComments,
    actionId,
  ) as unknown as Record<string, unknown>,
});

export const buildTriageOfflinePayload = (
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
    commentBody?: string;
    actionId?: string;
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

export const buildIntmuxOfflinePayload = (
  pjcode: string,
  item: ConsoleListItem,
  actionId?: string,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: INTMUX_OPERATION_PATH,
  requestBody: buildIntmuxRequest(pjcode, item, actionId),
});

const commentOfflinePayloadBuild = (
  pjcode: string,
  item: ConsoleListItem,
  body: string,
  actionId?: string,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: COMMENT_OPERATION_PATH,
  requestBody: commentRequestBuild(pjcode, item, body, actionId),
});

const dependedIssueUrlOfflinePayloadBuild = (
  pjcode: string,
  item: ConsoleListItem,
  dependedIssueUrl: string,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: SET_DEPENDED_ISSUE_URL_OPERATION_PATH,
  requestBody: {
    pjcode,
    issueUrl: item.url,
    dependedIssueUrl,
    projectItemId: item.projectItemId,
    replaceExisting: true,
  },
});

const deleteAllCommentsOfflinePayloadBuild = (
  item: ConsoleListItem,
  actionId?: string,
): ConsoleOfflinePayload => ({
  ...itemOfflineBase(item),
  apiPath: DELETE_ALL_COMMENTS_OPERATION_PATH,
  requestBody: deleteAllCommentsRequestBuild(item, actionId),
});

export const okAndAwaitingWorkspaceOfflinePayloadsBuild = (
  pjcode: string,
  item: ConsoleListItem,
  option: ConsoleFieldOption,
): ConsoleOfflinePayload[] => [
  buildTriageOfflinePayload(pjcode, item, 'set_status', {
    statusName: option.name,
    commentBody: AWAITING_WORKSPACE_COMMENT_BODY,
  }),
];

const COMMENT_HELD_OFFLINE_TOAST_COLOR = 'blue';

const commentHeldOfflineToastMessage = (item: ConsoleListItem): string =>
  `Commented — ${itemToastLabel(item)}`;

const generateCommentActionId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const OK_AND_CLOSE_COMMENT_BODY = 'ok';

const consoleItemActionTiming = (
  item: ConsoleListItem,
  actionDescription: string,
): { openedToActionMs?: number; actionDescription: string } => {
  const openedToActionMs = computeOpenedToActionMs(
    readConsoleItemOpenedAt(item.url),
    Date.now(),
  );
  return {
    actionDescription,
    ...(openedToActionMs === undefined ? {} : { openedToActionMs }),
  };
};

const SNOOZE_DAY_COUNT: Partial<Record<ConsoleNextActionDateAction, number>> = {
  snooze_1day: 1,
  snooze_2days: 2,
  snooze_3days: 3,
  snooze_5days: 5,
  snooze_1week: 7,
};

const SNOOZE_HOUR_COUNT: Partial<Record<ConsoleNextActionDateAction, number>> =
  {
    snooze_1hour: 1,
    snooze_3hours: 3,
    snooze_6hours: 6,
  };

const isoDateOf = (date: Date): string => date.toISOString().slice(0, 10);

const nextActionDescription = (
  action: ConsoleNextActionDateAction,
  now: number,
): string => {
  const label = consoleActionButtonLabels[action];
  const days = SNOOZE_DAY_COUNT[action];
  if (days !== undefined) {
    const target = isoDateOf(new Date(now + days * 24 * 60 * 60 * 1000));
    return `「${label}」を押しました（Next Action Date を ${target} に設定）`;
  }
  if (action === 'snooze_1month') {
    const current = new Date(now);
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(current.getUTCDate(), lastDay);
    const target = isoDateOf(new Date(Date.UTC(year, month, day)));
    return `「${label}」を押しました（Next Action Date を ${target} に設定）`;
  }
  const hours = SNOOZE_HOUR_COUNT[action];
  if (hours !== undefined) {
    const targetHour = (new Date(now).getUTCHours() + hours) % 24;
    return `「${label}」を押しました（Next Action Hour を ${targetHour} 時 に設定）`;
  }
  return `「${label}」を押しました`;
};

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
  onUploadFile?: (files: File | File[]) => Promise<string>;
  onCommentDraftRestored?: (projectItemId: string) => void;
  commentDraftRevision?: number;
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

type SavedDependedIssueUrls = {
  projectItemId: string;
  baseUrls: string[];
  urls: string[];
};

const isSameUrlList = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length && left.every((url, i) => url === right[i]);

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
  onUploadFile,
  onCommentDraftRestored,
  commentDraftRevision,
  onQueueAction,
  onCommentError,
  onDeleteStory,
  storyNameForDeletion,
  storyEntries,
  onCreateIssueFromComment,
}: ConsoleItemDetailContainerProps) => {
  useEffect(() => {
    recordConsoleItemOpened(item.url, Date.now());
  }, [item.url]);
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
  const [savedDependedIssueUrls, setSavedDependedIssueUrls] =
    useState<SavedDependedIssueUrls | null>(null);
  const latestDependedIssueUrlsRef = useRef(item.dependedIssueUrls);
  latestDependedIssueUrlsRef.current = item.dependedIssueUrls;
  useEffect(() => {
    setSavedDependedIssueUrls((saved) =>
      saved !== null && !isSameUrlList(saved.baseUrls, item.dependedIssueUrls)
        ? null
        : saved,
    );
  }, [item.dependedIssueUrls]);
  const recordSavedDependedIssueUrls = (
    baseUrls: string[],
    dependedIssueUrl: string,
  ): void => {
    if (!isSameUrlList(baseUrls, latestDependedIssueUrlsRef.current)) {
      return;
    }
    setSavedDependedIssueUrls({
      projectItemId: item.projectItemId,
      baseUrls,
      urls: parseDependedIssueUrlsInput(dependedIssueUrl),
    });
  };
  const savedDependedIssueUrlsOverride =
    savedDependedIssueUrls !== null &&
    savedDependedIssueUrls.projectItemId === item.projectItemId &&
    isSameUrlList(savedDependedIssueUrls.baseUrls, item.dependedIssueUrls)
      ? savedDependedIssueUrls.urls
      : null;
  const operationMenuItem =
    savedDependedIssueUrlsOverride === null
      ? item
      : { ...item, dependedIssueUrls: savedDependedIssueUrlsOverride };
  const [commentBodyOverrides, setCommentBodyOverrides] = useState<
    Record<number, string>
  >({});
  const bodyCheckboxConfirmedRef = useRef<Record<number, boolean>>({});
  const commentCheckboxConfirmedRef = useRef<Record<string, boolean>>({});
  const addComment = useCallback(
    async (
      body: string,
      timingOverride?: { openedToActionMs?: number; actionDescription: string },
    ): Promise<ConsoleCommentSubmitResult> => {
      const actionId = generateCommentActionId();
      const timing =
        timingOverride ??
        consoleItemActionTiming(item, 'コメントを投稿しました');
      const commentHoldOffline = (
        projectCode: string,
      ): ConsoleCommentSubmitResult => {
        onOfflineActionsCreate({
          payloads: [
            {
              ...commentOfflinePayloadBuild(projectCode, item, body, actionId),
              composerDraftBody: body,
            },
          ],
          message: commentHeldOfflineToastMessage(item),
          color: COMMENT_HELD_OFFLINE_TOAST_COLOR,
        });
        return 'held_offline';
      };
      if (isAirplaneModeOn && pjcode != null) {
        return commentHoldOffline(pjcode);
      }
      if (pjcode != null) {
        const descriptor: ConsoleOfflineQueuedAction = {
          id: actionId,
          actionId,
          message: commentHeldOfflineToastMessage(item),
          color: COMMENT_HELD_OFFLINE_TOAST_COLOR,
          enqueuedAt: Date.now(),
          ...commentOfflinePayloadBuild(pjcode, item, body, actionId),
          composerDraftBody: body,
        };
        persistConsoleAction(descriptor);
      }
      try {
        const comment = await operations.addComment(
          item,
          body,
          actionId,
          timing.openedToActionMs,
          timing.actionDescription,
        );
        if (pjcode != null) removePersistedConsoleAction(actionId);
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
      const actionId = generateCommentActionId();
      const prUrl = item.isPr
        ? item.url
        : (detail.relatedPullRequests[0]?.pullRequest.url ??
          item.relatedOpenPullRequestUrls[0] ??
          item.url);
      const reviewComments =
        action === 'request_changes' ? pendingReviewComments : [];
      const timing = consoleItemActionTiming(
        item,
        `「${consoleActionButtonLabels[action]}」を押しました`,
      );
      onQueueAction({
        kind: { type: 'review', action },
        item,
        commit: () =>
          operations.reviewPullRequest(
            item,
            prUrl,
            action,
            reviewComments,
            actionId,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
        offline:
          pjcode != null
            ? [
                buildReviewOfflinePayload(
                  pjcode,
                  item,
                  prUrl,
                  action,
                  reviewComments,
                  actionId,
                ),
              ]
            : undefined,
        overlayPatch: { done: true },
      });
    },
    onSetNextActionDate: (action) => {
      const actionId = generateCommentActionId();
      const actionDescription = nextActionDescription(action, Date.now());
      const timing = consoleItemActionTiming(item, actionDescription);
      onQueueAction({
        kind: { type: 'next_action_date', action },
        item,
        commit: () =>
          operations.setNextActionDate(
            item,
            action,
            actionId,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
        offline:
          pjcode != null
            ? [buildTriageOfflinePayload(pjcode, item, action, { actionId })]
            : undefined,
        overlayPatch: { done: true },
      });
    },
    onSetStory: (option: ConsoleFieldOption) => {
      const actionId = generateCommentActionId();
      const timing = consoleItemActionTiming(
        item,
        `「${option.name}」を押しました（Story を ${option.name} に変更）`,
      );
      onQueueAction({
        kind: { type: 'set_story', optionName: option.name },
        item,
        commit: async () => {
          await operations.setStory(
            item,
            option,
            actionId,
            timing.openedToActionMs,
            timing.actionDescription,
          );
        },
        offline:
          pjcode != null
            ? [
                buildTriageOfflinePayload(pjcode, item, 'set_story', {
                  storyOptionId: option.id,
                  actionId,
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
      const actionId = generateCommentActionId();
      const timing = consoleItemActionTiming(
        item,
        `「${option.name}」を押しました（Agent を ${option.name} に変更）`,
      );
      onQueueAction({
        kind: { type: 'set_agent', optionName: option.name },
        item,
        commit: () =>
          operations.setAgent(
            item,
            option,
            actionId,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
        offline:
          pjcode != null
            ? [
                buildTriageOfflinePayload(pjcode, item, 'set_agent', {
                  agentOptionId: option.id,
                  actionId,
                }),
              ]
            : undefined,
        overlayPatch: { done: true },
      });
    },
    onSetStatus: (option: ConsoleFieldOption) => {
      const timing = consoleItemActionTiming(
        item,
        `「${option.name}」を押しました（Status を ${option.name} に変更）`,
      );
      onQueueAction({
        kind: { type: 'set_status', optionName: option.name },
        item,
        commit: () =>
          operations.setStatus(
            item,
            option,
            undefined,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
        commitWithActionId: (_sentStepCount, actionId) =>
          operations.setStatus(
            item,
            option,
            actionId,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
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
      const actionId = generateCommentActionId();
      const timing = consoleItemActionTiming(
        item,
        `「${option.name}」を押しました（Status を ${option.name} に変更）`,
      );
      onQueueAction({
        kind: { type: 'set_in_tmux_by_human', optionName: option.name },
        item,
        commit: () =>
          operations.setInTmuxByHuman(
            item,
            option,
            actionId,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
        offline:
          pjcode != null
            ? [buildIntmuxOfflinePayload(pjcode, item, actionId)]
            : undefined,
        overlayPatch: {
          done: true,
          status: { name: option.name, color: option.color },
        },
      });
    },
    onClose: (action) => {
      const actionId = generateCommentActionId();
      const timing = consoleItemActionTiming(
        item,
        `「${consoleActionButtonLabels[action]}」を押しました`,
      );
      onQueueAction({
        kind: { type: 'close', action },
        item,
        commit: () =>
          operations.closeIssue(
            item,
            action,
            actionId,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
        offline:
          pjcode != null
            ? [buildTriageOfflinePayload(pjcode, item, action, { actionId })]
            : undefined,
        overlayPatch: { done: true, closed: true },
      });
    },
    onOkAndAwaitingWorkspace: (option: ConsoleFieldOption) => {
      const timing = consoleItemActionTiming(
        item,
        `「OK & Awaiting Workspace」を押しました（Status を ${option.name} に変更）`,
      );
      onQueueAction({
        kind: { type: 'ok_and_awaiting_workspace' },
        item,
        commit: () =>
          operations.okAndMoveToAwaitingWorkspace(
            item,
            option,
            0,
            undefined,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
        commitWithActionId: (sentStepCount, actionId) =>
          operations.okAndMoveToAwaitingWorkspace(
            item,
            option,
            sentStepCount,
            actionId,
            timing.openedToActionMs,
            timing.actionDescription,
          ),
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
      const actionId = generateCommentActionId();
      onQueueAction({
        kind: { type: 'delete_all_comments' },
        item,
        commit: () => operations.deleteAllComments(item, actionId),
        offline: [deleteAllCommentsOfflinePayloadBuild(item, actionId)],
      });
    },
    onDeleteStory: onDeleteStory ?? null,
    onSetDependedIssueUrl:
      pjcode != null
        ? async (dependedIssueUrl: string) => {
            const timing = consoleItemActionTiming(
              item,
              dependedIssueUrl === ''
                ? '「Set Depended Issue」を押しました（Depended Issue URL を解除）'
                : `「Set Depended Issue」を押しました（Depended Issue URL を ${dependedIssueUrl} に設定）`,
            );
            if (dependedIssueUrl === '' || awaitingWorkspaceOption === null) {
              const baseUrls = item.dependedIssueUrls;
              await operations.replaceDependedIssueUrl(
                item,
                dependedIssueUrl,
                timing.openedToActionMs,
                timing.actionDescription,
              );
              recordSavedDependedIssueUrls(baseUrls, dependedIssueUrl);
              return;
            }
            const baseUrls = item.dependedIssueUrls;
            const option = awaitingWorkspaceOption;
            const offline = [
              dependedIssueUrlOfflinePayloadBuild(
                pjcode,
                item,
                dependedIssueUrl,
              ),
              buildTriageOfflinePayload(pjcode, item, 'set_status', {
                statusName: option.name,
              }),
            ];
            await new Promise<void>((resolve, reject) => {
              onQueueAction({
                kind: {
                  type: 'set_status',
                  optionName: option.name,
                },
                item,
                commit: (sentStepCount) => {
                  const commitRun = consoleActionStepsRun(
                    [
                      () =>
                        operations
                          .replaceDependedIssueUrl(
                            item,
                            dependedIssueUrl,
                            timing.openedToActionMs,
                            timing.actionDescription,
                          )
                          .then(() =>
                            recordSavedDependedIssueUrls(
                              baseUrls,
                              dependedIssueUrl,
                            ),
                          ),
                      () =>
                        operations.setStatus(
                          item,
                          option,
                          undefined,
                          undefined,
                          undefined,
                        ),
                    ],
                    sentStepCount,
                  );
                  commitRun.then(resolve, (cause: unknown) => {
                    if (
                      !isHeldOfflineCommitFailure(
                        cause,
                        sentStepCount,
                        offline.length,
                      )
                    ) {
                      reject(cause);
                    }
                  });
                  return commitRun;
                },
                onUncommitted: (outcome) => {
                  if (outcome.status === 'held_offline') {
                    resolve();
                  } else if (outcome.status === 'undone') {
                    reject(
                      new Error(
                        'The depended issue URL change was undone and not saved.',
                      ),
                    );
                  } else {
                    reject(outcome.cause);
                  }
                },
                offline,
                overlayPatch: {
                  done: true,
                  status: {
                    name: option.name,
                    color: option.color,
                  },
                },
              });
            });
            recordSavedDependedIssueUrls(baseUrls, dependedIssueUrl);
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
              const timing = consoleItemActionTiming(
                item,
                `コメントを投稿して「${awaitingWorkspaceOption.name}」に変更しました`,
              );
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
                      await operations.setStatus(
                        item,
                        awaitingWorkspaceOption,
                        undefined,
                      );
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
                        undefined,
                        timing.openedToActionMs,
                        timing.actionDescription,
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
                commitWithActionId: async (sentStepCount, actionId) => {
                  if (sentStepCount > 0) {
                    await operations.setStatus(
                      item,
                      awaitingWorkspaceOption,
                      actionId,
                    );
                    return;
                  }
                  await operations.addCommentAndMoveToAwaitingWorkspace(
                    item,
                    body,
                    awaitingWorkspaceOption,
                    actionId,
                    timing.openedToActionMs,
                    timing.actionDescription,
                  );
                },
                offline:
                  pjcode != null
                    ? [
                        {
                          ...buildTriageOfflinePayload(
                            pjcode,
                            item,
                            'set_status',
                            {
                              statusName: awaitingWorkspaceOption.name,
                              commentBody: body,
                            },
                          ),
                          composerDraftBody: body,
                        },
                      ]
                    : undefined,
                revertAdvance: () => {
                  onCommentDraftChange?.(
                    mergeRestoredCommentDraft(
                      loadCommentDrafts().get(item.projectItemId) ?? '',
                      body,
                    ),
                  );
                  onCommentDraftRestored?.(item.projectItemId);
                },
                overlayPatch: {
                  done: true,
                  status: {
                    name: awaitingWorkspaceOption.name,
                    color: awaitingWorkspaceOption.color,
                  },
                },
                composerDraft: { projectItemId: item.projectItemId, body },
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
    const timing = consoleItemActionTiming(
      item,
      'コメントを投稿して閉じました',
    );
    if (pjcode == null) {
      await addComment(body, timing);
      await operations.closeIssue(item, 'close', generateCommentActionId());
      return;
    }
    const commentActionId = generateCommentActionId();
    const closeActionId = generateCommentActionId();
    onQueueAction({
      kind: { type: 'close', action: 'close' },
      item,
      commit: (sentStepCount) =>
        consoleActionStepsRun(
          [
            async () => {
              const comment = await operations.addComment(
                item,
                body,
                commentActionId,
                timing.openedToActionMs,
                timing.actionDescription,
              );
              setPostedComments((previous) => [...previous, comment]);
            },
            () =>
              operations.closeIssue(
                item,
                'close',
                closeActionId,
                undefined,
                undefined,
              ),
          ],
          sentStepCount,
        ),
      offline: [
        {
          ...commentOfflinePayloadBuild(pjcode, item, body, commentActionId),
          composerDraftBody: body,
        },
        buildTriageOfflinePayload(pjcode, item, 'close', {
          actionId: closeActionId,
        }),
      ],
      overlayPatch: { done: true, closed: true },
      composerDraft: { projectItemId: item.projectItemId, body },
    });
  };

  const commentAndCloseWithDraft = async (): Promise<void> => {
    const body = commentDraftRef.current.trim();
    if (body.length === 0) return;
    await commentAndClose(body);
  };

  const okAndClose = async (): Promise<void> => {
    const timing = consoleItemActionTiming(item, '「OK & Close」を押しました');
    const commentActionId = generateCommentActionId();
    const closeActionId = generateCommentActionId();
    onQueueAction({
      kind: { type: 'ok_and_close' },
      item,
      commit: (sentStepCount) =>
        consoleActionStepsRun(
          [
            async () => {
              await operations.addComment(
                item,
                OK_AND_CLOSE_COMMENT_BODY,
                commentActionId,
                timing.openedToActionMs,
                timing.actionDescription,
              );
            },
            () =>
              operations.closeIssue(
                item,
                'close',
                closeActionId,
                undefined,
                undefined,
              ),
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
                commentActionId,
              ),
              buildTriageOfflinePayload(pjcode, item, 'close', {
                actionId: closeActionId,
              }),
            ]
          : undefined,
      overlayPatch: { done: true, closed: true },
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
          key={commentDraftRevision}
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
          onUploadFile={
            onUploadFile ?? ((file) => operations.uploadAttachment(item, file))
          }
          onOpenChange={setIsCommentComposerOpen}
        />
      }
      operationBar={
        <ConsoleOperationMenu
          tab={tab}
          item={operationMenuItem}
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
