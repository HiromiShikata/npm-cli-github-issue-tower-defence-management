import { useCallback } from 'react';
import {
  type ConsoleIntmuxRequest,
  type ConsoleReviewCommentSide,
  type ConsoleReviewRequest,
  type ConsoleTriageRequest,
  encodeAttachmentContent,
  postConsoleAttachment,
  postConsoleComment,
  postConsoleDeleteAllComments,
  postConsoleIssueRename,
  postConsoleOperation,
  postConsoleReviewComment,
  postConsoleSetDependedIssueUrl,
} from '../lib/consoleApi';
import {
  buildRequestChangesBody,
  buildUnnecessaryIssueCommentBody,
  type ConsoleCloseAction,
  type ConsoleNextActionDateAction,
  type ConsolePendingReviewComment,
  type ConsoleReviewAction,
  TOTALLY_WRONG_COMMENT_BODY,
  UNNECESSARY_COMMENT_BODY,
} from '../logic/operations';
import type {
  ConsoleComment,
  ConsoleFieldOption,
  ConsoleListItem,
} from '../logic/types';
import type { ConsoleCaches } from './useConsoleCaches';

export const REVIEW_OPERATION_PATH = '/api/review';
export const TRIAGE_OPERATION_PATH = '/api/triage';
export const INTMUX_OPERATION_PATH = '/api/intmux';

export type ConsoleOperationsApi = {
  reviewPullRequest: (
    item: ConsoleListItem,
    prUrl: string,
    action: ConsoleReviewAction,
    pendingReviewComments?: ConsolePendingReviewComment[],
  ) => Promise<void>;
  setNextActionDate: (
    item: ConsoleListItem,
    action: ConsoleNextActionDateAction,
  ) => Promise<void>;
  setStory: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => Promise<void>;
  setAgent: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => Promise<void>;
  setStatus: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => Promise<void>;
  setInTmuxByHuman: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => Promise<void>;
  closeIssue: (
    item: ConsoleListItem,
    action: ConsoleCloseAction,
  ) => Promise<void>;
  okAndMoveToAwaitingWorkspace: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => Promise<void>;
  addComment: (item: ConsoleListItem, body: string) => Promise<ConsoleComment>;
  uploadAttachment: (item: ConsoleListItem, file: File) => Promise<string>;
  addInlineReviewComment: (
    prUrl: string,
    path: string,
    line: number,
    side: ConsoleReviewCommentSide,
    body: string,
  ) => Promise<void>;
  issueRename: (item: ConsoleListItem, newTitle: string) => Promise<void>;
  deleteAllComments: (item: ConsoleListItem) => Promise<void>;
  setDependedIssueUrl: (
    item: ConsoleListItem,
    dependedIssueUrl: string,
  ) => Promise<void>;
};

export const reviewRequest = (
  pjcode: string,
  item: ConsoleListItem,
  prUrl: string,
  action: ConsoleReviewAction,
  pendingReviewComments: ConsolePendingReviewComment[],
): ConsoleReviewRequest => {
  if (action === 'approve_and_merge') {
    return {
      pjcode,
      action: 'approve_and_merge',
      prUrl,
      projectItemId: item.projectItemId,
    };
  }
  if (action === 'request_changes') {
    const firstComment = pendingReviewComments[0];
    return {
      pjcode,
      action: 'request_changes',
      prUrl,
      projectItemId: item.projectItemId,
      commentBody: buildRequestChangesBody(pendingReviewComments),
      ...(firstComment === undefined
        ? {}
        : {
            changedFilePath: firstComment.path,
            line: firstComment.line,
            side: firstComment.side,
          }),
    };
  }
  if (action === 'totally_wrong') {
    return {
      pjcode,
      action: 'close',
      prUrl,
      issueUrl: item.url,
      projectItemId: item.projectItemId,
      commentBody: TOTALLY_WRONG_COMMENT_BODY,
    };
  }
  return {
    pjcode,
    action: 'unnecessary',
    prUrl,
    projectItemId: item.projectItemId,
    issueUrl: item.url,
    commentBody: UNNECESSARY_COMMENT_BODY,
    issueCommentBody: buildUnnecessaryIssueCommentBody(prUrl),
  };
};

export const buildTriageRequest = (
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
): ConsoleTriageRequest => ({
  pjcode,
  action,
  issueUrl: item.url,
  projectItemId: item.projectItemId,
  ...(extra ?? {}),
});

export const buildIntmuxRequest = (
  pjcode: string,
  item: ConsoleListItem,
): ConsoleIntmuxRequest => ({
  pjcode,
  action: 'set_intmux',
  issueUrl: item.url,
  projectItemId: item.projectItemId,
});

const missingPjcodeError = (): Error =>
  new Error('No project specified in the URL path.');

const AWAITING_WORKSPACE_COMMENT_BODY = 'ok';

export const useConsoleOperations = (
  pjcode: string | null,
  caches?: ConsoleCaches,
  onAfterMoveToAwaitingWorkspace?: () => Promise<void>,
): ConsoleOperationsApi => {
  const invalidateItemContent = useCallback(
    (item: ConsoleListItem) => {
      if (caches === undefined) {
        return;
      }
      const key = `${item.repo}#${item.number}`;
      caches.body.invalidate(key);
      caches.comments.invalidate(key);
    },
    [caches],
  );

  const reviewPullRequest = useCallback(
    async (
      item: ConsoleListItem,
      prUrl: string,
      action: ConsoleReviewAction,
      pendingReviewComments: ConsolePendingReviewComment[] = [],
    ) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      await postConsoleOperation(
        REVIEW_OPERATION_PATH,
        reviewRequest(pjcode, item, prUrl, action, pendingReviewComments),
      );
      invalidateItemContent(item);
    },
    [pjcode, invalidateItemContent],
  );

  const setNextActionDate = useCallback(
    async (item: ConsoleListItem, action: ConsoleNextActionDateAction) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const request: ConsoleTriageRequest = {
        pjcode,
        action,
        issueUrl: item.url,
        projectItemId: item.projectItemId,
      };
      await postConsoleOperation(TRIAGE_OPERATION_PATH, request);
      invalidateItemContent(item);
    },
    [pjcode, invalidateItemContent],
  );

  const setAgent = useCallback(
    async (item: ConsoleListItem, option: ConsoleFieldOption) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const request: ConsoleTriageRequest = {
        pjcode,
        action: 'set_agent',
        issueUrl: item.url,
        projectItemId: item.projectItemId,
        agentOptionId: option.id,
      };
      await postConsoleOperation(TRIAGE_OPERATION_PATH, request);
      invalidateItemContent(item);
    },
    [pjcode, invalidateItemContent],
  );

  const setStory = useCallback(
    async (item: ConsoleListItem, option: ConsoleFieldOption) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const request: ConsoleTriageRequest = {
        pjcode,
        action: 'set_story',
        issueUrl: item.url,
        projectItemId: item.projectItemId,
        storyOptionId: option.id,
      };
      await postConsoleOperation(TRIAGE_OPERATION_PATH, request);
      invalidateItemContent(item);
    },
    [pjcode, invalidateItemContent],
  );

  const setStatus = useCallback(
    async (item: ConsoleListItem, option: ConsoleFieldOption) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const request: ConsoleTriageRequest = {
        pjcode,
        action: 'set_status',
        issueUrl: item.url,
        projectItemId: item.projectItemId,
        statusName: option.name,
      };
      await postConsoleOperation(TRIAGE_OPERATION_PATH, request);
      invalidateItemContent(item);
    },
    [pjcode, invalidateItemContent],
  );

  const setInTmuxByHuman = useCallback(
    async (item: ConsoleListItem, _option: ConsoleFieldOption) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const request: ConsoleIntmuxRequest = {
        pjcode,
        action: 'set_intmux',
        issueUrl: item.url,
        projectItemId: item.projectItemId,
      };
      await postConsoleOperation(INTMUX_OPERATION_PATH, request);
      invalidateItemContent(item);
    },
    [pjcode, invalidateItemContent],
  );

  const closeIssue = useCallback(
    async (item: ConsoleListItem, action: ConsoleCloseAction) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const request: ConsoleTriageRequest = {
        pjcode,
        action,
        issueUrl: item.url,
        projectItemId: item.projectItemId,
      };
      await postConsoleOperation(TRIAGE_OPERATION_PATH, request);
      invalidateItemContent(item);
    },
    [pjcode, invalidateItemContent],
  );

  const okAndMoveToAwaitingWorkspace = useCallback(
    async (item: ConsoleListItem, option: ConsoleFieldOption) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const commentResult = await postConsoleComment({
        pjcode,
        url: item.url,
        body: AWAITING_WORKSPACE_COMMENT_BODY,
      });
      const request: ConsoleTriageRequest = {
        pjcode,
        action: 'set_status',
        issueUrl: item.url,
        projectItemId: item.projectItemId,
        statusName: option.name,
      };
      await postConsoleOperation(TRIAGE_OPERATION_PATH, request);
      invalidateItemContent(item);
      await onAfterMoveToAwaitingWorkspace?.();
      if (!commentResult.posted) {
        const resetInfo =
          commentResult.rateLimitResetAt !== null
            ? ` Rate limit resets at ${commentResult.rateLimitResetAt}.`
            : '';
        throw new Error(
          `Comment not posted — ${commentResult.error}.${resetInfo} Status was changed. Re-post: ${AWAITING_WORKSPACE_COMMENT_BODY}`,
        );
      }
    },
    [pjcode, invalidateItemContent, onAfterMoveToAwaitingWorkspace],
  );

  const addComment = useCallback(
    async (item: ConsoleListItem, body: string) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const result = await postConsoleComment({ pjcode, url: item.url, body });
      if (!result.posted) {
        const resetInfo =
          result.rateLimitResetAt !== null
            ? ` Rate limit resets at ${result.rateLimitResetAt}.`
            : '';
        throw new Error(`${result.error}.${resetInfo}`);
      }
      invalidateItemContent(item);
      return result.comment;
    },
    [pjcode, invalidateItemContent],
  );

  const uploadAttachment = useCallback(
    async (item: ConsoleListItem, file: File) => {
      if (pjcode === null) {
        throw new Error('no project in the URL path');
      }
      const contentBase64 = encodeAttachmentContent(
        new Uint8Array(await file.arrayBuffer()),
      );
      return postConsoleAttachment({
        pjcode,
        url: item.url,
        fileName: file.name,
        contentBase64,
      });
    },
    [pjcode],
  );

  const addInlineReviewComment = useCallback(
    async (
      prUrl: string,
      path: string,
      line: number,
      side: ConsoleReviewCommentSide,
      body: string,
    ) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      await postConsoleReviewComment({
        pjcode,
        url: prUrl,
        path,
        line,
        side,
        body,
      });
    },
    [pjcode],
  );

  const issueRename = useCallback(
    async (item: ConsoleListItem, newTitle: string) => {
      await postConsoleIssueRename({ issueUrl: item.url, newTitle });
    },
    [],
  );

  const deleteAllComments = useCallback(
    async (item: ConsoleListItem) => {
      await postConsoleDeleteAllComments({ issueUrl: item.url });
      invalidateItemContent(item);
    },
    [invalidateItemContent],
  );

  const setDependedIssueUrl = useCallback(
    async (item: ConsoleListItem, dependedIssueUrl: string) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      await postConsoleSetDependedIssueUrl({
        pjcode,
        issueUrl: item.url,
        dependedIssueUrl,
      });
    },
    [pjcode],
  );

  return {
    reviewPullRequest,
    setNextActionDate,
    setStory,
    setAgent,
    setStatus,
    setInTmuxByHuman,
    closeIssue,
    okAndMoveToAwaitingWorkspace,
    addComment,
    uploadAttachment,
    addInlineReviewComment,
    issueRename,
    deleteAllComments,
    setDependedIssueUrl,
  };
};
