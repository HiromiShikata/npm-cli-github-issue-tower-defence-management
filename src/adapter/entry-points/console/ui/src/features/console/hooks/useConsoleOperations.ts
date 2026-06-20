import { useCallback } from 'react';
import {
  type ConsoleIntmuxRequest,
  type ConsoleReviewRequest,
  type ConsoleTriageRequest,
  postConsoleOperation,
} from '../lib/consoleApi';
import {
  type ConsoleCloseAction,
  type ConsoleNextActionDateAction,
  type ConsoleReviewAction,
  TOTALLY_WRONG_COMMENT_BODY,
  UNNECESSARY_COMMENT_BODY,
} from '../logic/operations';
import { overlayKeyForItem } from '../logic/overlay';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleTabName,
} from '../logic/types';
import type { ConsoleOverlayState } from './useConsoleOverlay';
import { useConsoleToken } from './useConsoleToken';

export const REVIEW_OPERATION_PATH = '/api/review';
export const TRIAGE_OPERATION_PATH = '/api/triage';
export const INTMUX_OPERATION_PATH = '/api/intmux';

export type ConsoleOperationsApi = {
  reviewPullRequest: (
    item: ConsoleListItem,
    prUrl: string,
    action: ConsoleReviewAction,
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
};

const reviewRequest = (
  pjcode: string,
  item: ConsoleListItem,
  prUrl: string,
  action: ConsoleReviewAction,
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
    return {
      pjcode,
      action: 'request_changes',
      prUrl,
      projectItemId: item.projectItemId,
      commentBody: '',
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
): ConsoleOperationsApi => {
  const { appendToken } = useConsoleToken();
  const { patchOverlay } = overlayState;

  const markDone = useCallback(
    (item: ConsoleListItem) => {
      patchOverlay(overlayKeyForItem(item), { done: true }, mode);
    },
    [patchOverlay, mode],
  );

  const reviewPullRequest = useCallback(
    async (
      item: ConsoleListItem,
      prUrl: string,
      action: ConsoleReviewAction,
    ) => {
      if (pjcode === null) {
        throw missingPjcodeError();
      }
      await postConsoleOperation(
        appendToken,
        REVIEW_OPERATION_PATH,
        reviewRequest(pjcode, item, prUrl, action),
      );
      markDone(item);
    },
    [pjcode, appendToken, markDone],
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
      await postConsoleOperation(appendToken, TRIAGE_OPERATION_PATH, request);
      if (mode === 'todo-by-human') {
        markDone(item);
      }
    },
    [pjcode, appendToken, markDone, mode],
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
      await postConsoleOperation(appendToken, TRIAGE_OPERATION_PATH, request);
      patchOverlay(
        overlayKeyForItem(item),
        { done: true, story: { name: option.name, color: option.color } },
        mode,
      );
    },
    [pjcode, appendToken, patchOverlay, mode],
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
      await postConsoleOperation(appendToken, TRIAGE_OPERATION_PATH, request);
      patchOverlay(
        overlayKeyForItem(item),
        { done: true, status: { name: option.name, color: option.color } },
        mode,
      );
    },
    [pjcode, appendToken, patchOverlay, mode],
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
      await postConsoleOperation(appendToken, INTMUX_OPERATION_PATH, request);
      patchOverlay(
        overlayKeyForItem(item),
        { done: true, status: { name: option.name, color: option.color } },
        mode,
      );
    },
    [pjcode, appendToken, patchOverlay, mode],
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
      await postConsoleOperation(appendToken, TRIAGE_OPERATION_PATH, request);
      markDone(item);
    },
    [pjcode, appendToken, markDone],
  );

  return {
    reviewPullRequest,
    setNextActionDate,
    setStory,
    setStatus,
    setInTmuxByHuman,
    closeIssue,
  };
};
