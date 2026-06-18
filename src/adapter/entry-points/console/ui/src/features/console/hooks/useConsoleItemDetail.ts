import { useEffect, useState } from 'react';
import type {
  ConsoleComment,
  ConsoleListItem,
  ConsolePullRequestDetail,
  ConsoleRelatedPullRequest,
} from '../types';
import type { ConsoleItemCache } from './consoleItemCache';

export type ConsoleItemDetailState = {
  body: string;
  isBodyLoading: boolean;
  bodyError: string | null;
  comments: ConsoleComment[];
  areCommentsLoading: boolean;
  commentsError: string | null;
  pullRequestDetail: ConsolePullRequestDetail | null;
  relatedPullRequests: ConsoleRelatedPullRequest[];
  isPullRequestLoading: boolean;
  pullRequestError: string | null;
};

const initialState: ConsoleItemDetailState = {
  body: '',
  isBodyLoading: true,
  bodyError: null,
  comments: [],
  areCommentsLoading: true,
  commentsError: null,
  pullRequestDetail: null,
  relatedPullRequests: [],
  isPullRequestLoading: false,
  pullRequestError: null,
};

const toMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export const useConsoleItemDetail = (
  cache: ConsoleItemCache,
  item: ConsoleListItem | null,
): ConsoleItemDetailState => {
  const [state, setState] = useState<ConsoleItemDetailState>(initialState);

  useEffect(() => {
    if (item === null) {
      setState(initialState);
      return;
    }
    let cancelled = false;
    setState({
      ...initialState,
      isPullRequestLoading: item.isPr,
    });

    cache
      .getItemBody(item.repo, item.number)
      .then((itemBody) => {
        if (cancelled) {
          return;
        }
        setState((current) => ({
          ...current,
          body: itemBody.body,
          isBodyLoading: false,
          comments: itemBody.comments,
          areCommentsLoading: false,
        }));
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        setState((current) => ({
          ...current,
          isBodyLoading: false,
          bodyError: toMessage(cause),
          areCommentsLoading: false,
          commentsError: toMessage(cause),
        }));
      });

    const loadPullRequest = async (): Promise<void> => {
      const relatedPullRequests = item.isPr
        ? []
        : await cache.getRelatedPullRequests(item.repo, item.number);
      const target = item.isPr
        ? { repo: item.repo, number: item.number }
        : (relatedPullRequests[0] ?? null);
      if (target === null) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            relatedPullRequests,
            isPullRequestLoading: false,
          }));
        }
        return;
      }
      if (!cancelled) {
        setState((current) => ({
          ...current,
          relatedPullRequests,
          isPullRequestLoading: true,
        }));
      }
      const detail = await cache.getPullRequestDetail(
        target.repo,
        target.number,
      );
      if (!cancelled) {
        setState((current) => ({
          ...current,
          pullRequestDetail: detail,
          isPullRequestLoading: false,
        }));
      }
    };

    loadPullRequest().catch((cause: unknown) => {
      if (cancelled) {
        return;
      }
      setState((current) => ({
        ...current,
        isPullRequestLoading: false,
        pullRequestError: toMessage(cause),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [cache, item]);

  return state;
};
