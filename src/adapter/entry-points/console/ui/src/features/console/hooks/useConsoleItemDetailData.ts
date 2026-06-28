import { useEffect, useState } from 'react';
import type { ConsoleRelatedPullRequestView } from '../components/detail/ConsoleItemDetail';
import type {
  ConsoleChangedFile,
  ConsoleComment,
  ConsoleCommit,
  ConsoleIssueState,
  ConsoleListItem,
  ConsolePullRequestStatus,
  ConsoleRelatedPullRequest,
} from '../logic/types';
import type { ConsoleCaches } from './useConsoleCaches';
import { useConsoleResource } from './useConsoleResource';

const EMPTY_COMMENTS: ConsoleComment[] = [];
const EMPTY_FILES: ConsoleChangedFile[] = [];
const EMPTY_COMMITS: ConsoleCommit[] = [];
const EMPTY_RELATED: ConsoleRelatedPullRequest[] = [];
const DEFAULT_STATE: ConsoleIssueState = {
  state: 'open',
  merged: false,
  isPullRequest: false,
};
const DEFAULT_PR_STATUS: ConsolePullRequestStatus = {
  found: false,
  isConflicted: false,
  isPassedAllCiJob: false,
  isCiStateSuccess: false,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
};

export type ConsoleItemDetailData = {
  state: ConsoleIssueState | null;
  body: string;
  bodyIsLoading: boolean;
  bodyError: string | null;
  comments: ConsoleComment[];
  commentsAreLoading: boolean;
  commentsError: string | null;
  files: ConsoleChangedFile[];
  filesAreLoading: boolean;
  filesError: string | null;
  commits: ConsoleCommit[];
  commitsAreLoading: boolean;
  commitsError: string | null;
  pullRequestStatus: ConsolePullRequestStatus | null;
  relatedPullRequests: ConsoleRelatedPullRequestView[];
};

export const useConsoleItemDetailData = (
  caches: ConsoleCaches,
  item: ConsoleListItem | null,
): ConsoleItemDetailData => {
  const key = item !== null ? `${item.repo}#${item.number}` : null;
  const url = item !== null ? item.url : null;
  const isPr = item?.isPr ?? false;

  const body = useConsoleResource(caches.body, key, url, '');
  const state = useConsoleResource(caches.state, key, url, DEFAULT_STATE);
  const comments = useConsoleResource(
    caches.comments,
    key,
    url,
    EMPTY_COMMENTS,
  );
  const files = useConsoleResource(
    caches.files,
    isPr ? key : null,
    isPr ? url : null,
    EMPTY_FILES,
  );
  const commits = useConsoleResource(
    caches.commits,
    isPr ? key : null,
    isPr ? url : null,
    EMPTY_COMMITS,
  );
  const prStatus = useConsoleResource(
    caches.prStatus,
    isPr ? key : null,
    isPr ? url : null,
    DEFAULT_PR_STATUS,
  );
  const relatedPrs = useConsoleResource(
    caches.relatedPrs,
    !isPr ? key : null,
    !isPr ? url : null,
    EMPTY_RELATED,
  );

  const [relatedViews, setRelatedViews] = useState<
    ConsoleRelatedPullRequestView[]
  >([]);

  useEffect(() => {
    if (isPr || relatedPrs.data.length === 0) {
      setRelatedViews([]);
      return;
    }
    let cancelled = false;
    const initial: ConsoleRelatedPullRequestView[] = relatedPrs.data.map(
      (pullRequest) => ({
        pullRequest,
        files: EMPTY_FILES,
        filesAreLoading: true,
        filesError: null,
        commits: EMPTY_COMMITS,
        commitsAreLoading: true,
        commitsError: null,
      }),
    );
    setRelatedViews(initial);

    const updateView = (
      prUrl: string,
      patch: Partial<ConsoleRelatedPullRequestView>,
    ): void => {
      if (cancelled) {
        return;
      }
      setRelatedViews((current) =>
        current.map((view) =>
          view.pullRequest.url === prUrl ? { ...view, ...patch } : view,
        ),
      );
    };

    for (const pullRequest of relatedPrs.data) {
      const relatedKey = pullRequest.url;
      caches.files
        .load(relatedKey, pullRequest.url)
        .then((value) =>
          updateView(pullRequest.url, {
            files: value,
            filesAreLoading: false,
          }),
        )
        .catch((cause: unknown) =>
          updateView(pullRequest.url, {
            filesAreLoading: false,
            filesError: cause instanceof Error ? cause.message : String(cause),
          }),
        );
      caches.commits
        .load(relatedKey, pullRequest.url)
        .then((value) =>
          updateView(pullRequest.url, {
            commits: value,
            commitsAreLoading: false,
          }),
        )
        .catch((cause: unknown) =>
          updateView(pullRequest.url, {
            commitsAreLoading: false,
            commitsError:
              cause instanceof Error ? cause.message : String(cause),
          }),
        );
    }

    return () => {
      cancelled = true;
    };
  }, [caches, isPr, relatedPrs.data]);

  return {
    state: state.data,
    body: body.data,
    bodyIsLoading: body.isLoading,
    bodyError: body.error,
    comments: comments.data,
    commentsAreLoading: comments.isLoading,
    commentsError: comments.error,
    files: files.data,
    filesAreLoading: files.isLoading,
    filesError: files.error,
    commits: commits.data,
    commitsAreLoading: commits.isLoading,
    commitsError: commits.error,
    pullRequestStatus: isPr ? prStatus.data : null,
    relatedPullRequests: relatedViews,
  };
};
