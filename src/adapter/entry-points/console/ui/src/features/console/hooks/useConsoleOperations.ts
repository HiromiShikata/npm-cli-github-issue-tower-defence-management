import { useCallback } from 'react';
import {
  type ConsoleIntmuxRequest,
  type ConsoleReviewCommentSide,
  type ConsoleReviewRequest,
  type ConsoleTriageRequest,
  postConsoleComment,
  postConsoleOperation,
  postConsoleReviewComment,
} from '../lib/consoleApi';
import {
  buildRequestChangesBody,
  type ConsoleCloseAction,
  type ConsoleNextActionDateAction,
  type ConsolePendingReviewComment,
  type ConsoleReviewAction,
  TOTALLY_WRONG_COMMENT_BODY,
  UNNECESSARY_COMMENT_BODY,
} from '../logic/operations';
import { overlayKeyForItem } from '../logic/overlay';
import type {
  ConsoleComment,
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleTabName,
} from '../logic/types';
import type { ConsoleCaches } from './useConsoleCaches';
import type { ConsoleOverlayState } from './useConsoleOverlay';

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
  addComment: (item: ConsoleListItem, body: string) => Promise<ConsoleComment>;
  addInlineReviewComment: (
    prUrl: string,
    path: string,
    line: number,
    side: ConsoleReviewCommentSide,
    body: string,
  ) => Promise<void>;
};

const reviewRequest = (
  pjcode: string,
  item: ConsoleListItem,
  prUrl: string,
  action: ConsoleReviewAction,
  pendingReviewComments: ConsolePendingReviewComment[],
): ConsoleReviewRequest => {
  if (action === 'approve') {
    return {
      pjcode,
      action: 'approve',
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
      projectItemId: item.projectItemId,
      commentBody: TOTALLY_WRONG_COMMENT_BODY,
    };
  }
  return {
    pjcode,
    action: 'close',
    prUrl,
    projectItemId: item.projectItemId,
    commentBody: UNNECESSARY_COMMENT_BODY,
  };
};

const missingPjcodeError = (): Error =>
  new Error('No project specified in the URL path.');

export const useConsoleOperations = (
  pjcode: string | null,
  mode: ConsoleTabName,
  overlayState: ConsoleOverlayState,
  caches?: ConsoleCaches,
): ConsoleOperationsApi => {
  const { patchOverlay } = overlayState;

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

  const markDone = useCallback(
    (item: ConsoleListItem) => {
      invalidateItemContent(item);
      patchOverlay(overlayKeyForItem(item), { done: true }, mode);
    },
    [invalidateItemContent, patchOverlay, mode],
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
      markDone(item);
    },
    [pjcode, markDone],
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
      markDone(item);
    },
    [pjcode, markDone],
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
      patchOverlay(
        overlayKeyForItem(item),
        { done: true, story: { name: option.name, color: option.color } },
        mode,
      );
    },
    [pjcode, invalidateItemContent, patchOverlay, mode],
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
      patchOverlay(
        overlayKeyForItem(item),
        { done: true, status: { name: option.name, color: option.color } },
        mode,
      );
    },
    [pjcode, invalidateItemContent, patchOverlay, mode],
  );

  const setInTmuxByHuman = useCallback(
    async (item: ConsoleListItem, option: ConsoleFieldOption) => {
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
      patchOverlay(
        overlayKeyForItem(item),
        { done: true, status: { name: option.name, color: option.color } },
        mode,
      );
    },
    [pjcode, invalidateItemContent, patchOverlay, mode],
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
      markDone(item);
    },
    [pjcode, markDone],
  );

  const addComment = useCallback(
    async (item: ConsoleListItem, body: string) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      const comment = await postConsoleComment({
        pjcode,
        url: item.url,
        body,
      });
      invalidateItemContent(item);
      return comment;
    },
    [pjcode, invalidateItemContent],
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

  return {
    reviewPullRequest,
    setNextActionDate,
    setStory,
    setStatus,
    setInTmuxByHuman,
    closeIssue,
    addComment,
    addInlineReviewComment,
  };
};
