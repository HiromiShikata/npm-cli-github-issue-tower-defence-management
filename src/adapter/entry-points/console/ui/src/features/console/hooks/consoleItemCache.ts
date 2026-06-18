import type {
  ConsoleComment,
  ConsoleItemBody,
  ConsolePullRequestDetail,
  ConsoleRelatedPullRequest,
} from '../types';
import type { ConsoleApiClient } from './consoleApiClient';

export type ConsoleItemCache = {
  getItemBody: (repo: string, number: number) => Promise<ConsoleItemBody>;
  getComments: (repo: string, number: number) => Promise<ConsoleComment[]>;
  getRelatedPullRequests: (
    repo: string,
    number: number,
  ) => Promise<ConsoleRelatedPullRequest[]>;
  getPullRequestDetail: (
    repo: string,
    number: number,
  ) => Promise<ConsolePullRequestDetail | null>;
};

const cacheKey = (repo: string, number: number): string => `${repo}#${number}`;

type SharedFetch<T> = {
  values: Map<string, T>;
  inFlight: Map<string, Promise<T>>;
};

const createSharedFetch = <T>(): SharedFetch<T> => ({
  values: new Map(),
  inFlight: new Map(),
});

const runShared = <T>(
  shared: SharedFetch<T>,
  key: string,
  produce: () => Promise<T>,
): Promise<T> => {
  const cached = shared.values.get(key);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }
  const existing = shared.inFlight.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const promise = produce()
    .then((value) => {
      shared.values.set(key, value);
      return value;
    })
    .finally(() => {
      shared.inFlight.delete(key);
    });
  shared.inFlight.set(key, promise);
  return promise;
};

export const createConsoleItemCache = (
  client: ConsoleApiClient,
): ConsoleItemCache => {
  const bodyFetch = createSharedFetch<ConsoleItemBody>();
  const relatedFetch = createSharedFetch<ConsoleRelatedPullRequest[]>();
  const detailFetch = createSharedFetch<ConsolePullRequestDetail | null>();

  const getItemBody = (
    repo: string,
    number: number,
  ): Promise<ConsoleItemBody> =>
    runShared(bodyFetch, cacheKey(repo, number), () =>
      client.fetchItemBody(repo, number),
    );

  const getRelatedPullRequests = (
    repo: string,
    number: number,
  ): Promise<ConsoleRelatedPullRequest[]> =>
    runShared(relatedFetch, cacheKey(repo, number), () =>
      client.fetchRelatedPullRequests(repo, number),
    );

  const getPullRequestDetail = (
    repo: string,
    number: number,
  ): Promise<ConsolePullRequestDetail | null> =>
    runShared(detailFetch, cacheKey(repo, number), async () => {
      const [detail, files, commits] = await Promise.all([
        client.fetchPullRequestDetail(repo, number),
        client.fetchPullRequestFiles(repo, number),
        client.fetchPullRequestCommits(repo, number),
      ]);
      if (detail === null) {
        return null;
      }
      return { ...detail, files, commits };
    });

  return {
    getItemBody,
    getComments: async (repo, number) =>
      (await getItemBody(repo, number)).comments,
    getRelatedPullRequests,
    getPullRequestDetail,
  };
};
